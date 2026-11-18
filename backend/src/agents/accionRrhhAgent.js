'use strict';

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  sequelize,
  Colaborador,
  SaldoVacaciones,
  Solicitud,
  Incapacidad,
  TicketRRHH,
  PalabraClave,
  ConsultaChat
} = require('../models');
const { chatWithTools } = require('../config/llmClient');
const { safeParseJson } = require('../utils/jsonHelper');
const { calculateRequestedDays } = require('../controllers/solicitudController');
const { generateDailyReport } = require('./analistaAgent');

const ADMIN_SYSTEM_PROMPT = `Eres el Agente de Acciones Administrativas de Talento Humano (rol RRHH) de NovaCore Technologies Costa Rica S.A.
Tienes acceso autorizado para ejecutar cambios administrativos reales mediante tus herramientas conectadas al sistema interno de RRHH.

REGLAS DE COMPORTAMIENTO:
1. PROPUESTA VS. EJECUCIÓN:
   - Si la Directora/usuario RRHH plantea una idea tentativa o pide revisar impacto antes de actuar (ej. "vamos a cederle...", "estoy pensando en aprobar...", "¿qué pasa si aprobamos...?"), NO ejecutes cambios todavía: utiliza "gestionar_solicitud" con accion="previsualizar" (o consulta los datos actuales) y muestra el resumen real (saldo disponible, días requeridos, traslapes en el mismo departamento) pidiendo confirmación explícita.
   - Si da una orden directa ("Aprueba...", "Rechaza...", "Agrega...", "Crea...", "Edita...", "Desactiva...", "Quita...", "Elimina...", "Acredita...", "Descuenta...", "Fija...", "Registra...", "Resuelve...", "Regenera...") o confirma una propuesta previa ("Sí", "Confirmo", "Dale", "Hazlo", "Adelante"), EJECUTA de inmediato la herramienta correspondiente y muestra una ficha clara con los valores anteriores y posteriores.
2. MEMORIA CONVERSACIONAL: Utiliza el historial reciente para resolver referencias implícitas como "sí, apruébala", "elimínala", "aplícalo a ese colaborador", "ciérralo".
3. CERO JERGA TÉCNICA: Jamás menciones en tu respuesta palabras técnicas internas como "JSON", "payload", "ORM", "Sequelize", "query", "endpoint" ni "base de datos". Habla siempre en lenguaje ejecutivo natural de Talento Humano.
4. VERACIDAD ESTRICTA: Reporta únicamente los datos, nombres, códigos y resultados reales devueltos por las herramientas.`;

const ACTION_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'gestionar_solicitud',
      description:
        'Previsualizar, aprobar o rechazar una solicitud de vacaciones, permiso o teletrabajo. Al aprobar vacaciones descuenta el saldo disponible y verifica traslapes en el mismo departamento.',
      parameters: {
        type: 'object',
        properties: {
          accion: {
            type: 'string',
            enum: ['previsualizar', 'aprobar', 'rechazar']
          },
          solicitud_id: { type: 'integer', description: 'ID numérico de la solicitud si se conoce' },
          colaborador_nombre: { type: 'string', description: 'Nombre o parte del nombre del colaborador' },
          tipo_solicitud: {
            type: 'string',
            enum: ['vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'teletrabajo']
          }
        },
        required: ['accion']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'gestionar_colaborador',
      description:
        'Registrar un nuevo colaborador (con saldo inicial de 15 días de vacaciones), editar puesto/departamento/correo/rol/estado o desactivar/reactivar a un colaborador existente.',
      parameters: {
        type: 'object',
        properties: {
          accion: {
            type: 'string',
            enum: ['crear', 'editar', 'desactivar', 'reactivar']
          },
          colaborador_id: { type: 'integer' },
          nombre_buscar: { type: 'string', description: 'Nombre o correo actual para localizar al colaborador' },
          nombre: { type: 'string' },
          email: { type: 'string' },
          departamento: { type: 'string' },
          puesto: { type: 'string' },
          fecha_ingreso: { type: 'string', description: 'YYYY-MM-DD' },
          rol: { type: 'string', enum: ['colaborador', 'rrhh'] },
          estado: { type: 'string', enum: ['activo', 'inactivo'] }
        },
        required: ['accion']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'ajustar_saldo_vacaciones',
      description:
        'Acreditar, descontar o fijar días de vacaciones de un colaborador específico mostrando saldo anterior y nuevo.',
      parameters: {
        type: 'object',
        properties: {
          accion: {
            type: 'string',
            enum: ['acreditar', 'descontar', 'fijar']
          },
          colaborador_id: { type: 'integer' },
          colaborador_nombre: { type: 'string' },
          dias: { type: 'number', description: 'Cantidad de días a acreditar, descontar o fijar' }
        },
        required: ['accion', 'dias']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'registrar_incapacidad',
      description:
        'Registrar o actualizar una incapacidad CCSS o INS para un colaborador, calculando automáticamente fechas y cobertura salarial según la política vigente.',
      parameters: {
        type: 'object',
        properties: {
          accion: { type: 'string', enum: ['crear', 'actualizar'] },
          incapacidad_id: { type: 'integer' },
          colaborador_id: { type: 'integer' },
          colaborador_nombre: { type: 'string' },
          entidad: { type: 'string', enum: ['CCSS', 'INS'] },
          tipo: { type: 'string', enum: ['enfermedad_comun', 'riesgo_trabajo', 'maternidad'] },
          fecha_inicio: { type: 'string', description: 'YYYY-MM-DD' },
          fecha_fin: { type: 'string', description: 'YYYY-MM-DD opcional' },
          dias_totales: { type: 'integer', description: 'Cantidad total de días' }
        },
        required: ['accion']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'resolver_ticket',
      description:
        'Responder, pasar a revisión o cerrar/resolver un ticket escalado de Talento Humano por código (TKT-2026-XXX), ID o nombre del colaborador.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código TKT-YYYY-XXX' },
          ticket_id: { type: 'integer' },
          colaborador_nombre: { type: 'string' },
          respuesta_rrhh: { type: 'string', description: 'Respuesta oficial emitida por RRHH' },
          estado: { type: 'string', enum: ['resuelto', 'en_revision'] }
        },
        required: ['respuesta_rrhh']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'gestionar_palabra_clave',
      description:
        'Agregar, activar, desactivar o eliminar palabras clave operativas o de clasificación e invalidar la caché de clasificación.',
      parameters: {
        type: 'object',
        properties: {
          accion: {
            type: 'string',
            enum: ['agregar', 'activar', 'desactivar', 'eliminar']
          },
          id: { type: 'integer' },
          palabra: { type: 'string' },
          categoria: {
            type: 'string',
            enum: ['restringida', 'fuera_alcance', 'politica', 'dato_personal', 'tema_dashboard']
          },
          tema_asociado: { type: 'string' }
        },
        required: ['accion', 'palabra']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'regenerar_reporte_diario',
      description: 'Recalcula y actualiza los indicadores diarios del reporte ejecutivo RRHH.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'YYYY-MM-DD opcional (por defecto hoy)' }
        }
      }
    }
  }
];

function norm(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addCalendarDaysIso(startIso, offsetDays) {
  const dt = new Date(`${startIso}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return startIso;
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

function diffCalendarDaysInclusive(startIso, endIso) {
  const s = new Date(`${startIso}T12:00:00Z`);
  const e = new Date(`${endIso}T12:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

function calculateSubsidyPolicy({ tipo, entidad, dias }) {
  if (tipo === 'maternidad') {
    return '100 % del salario (50 % patrono + 50 % CCSS durante 4 meses de licencia)';
  }
  if (tipo === 'riesgo_trabajo' || entidad === 'INS') {
    return '100 % cobertura póliza de Riesgos del Trabajo del INS desde el día 1';
  }
  if (Number(dias) <= 3) {
    return '100 % del salario (50 % patrono + 50 % complemento NovaCore para días 1 al 3)';
  }
  return '100 % del salario hasta el día 30 (días 1–3: 50 % patrono + 50 % complemento; día 4+: 60 % CCSS + 40 % complemento NovaCore)';
}

async function resolveColaborador({ id, query, transaction = null }) {
  if (id) {
    const byId = await Colaborador.findByPk(Number(id), { transaction });
    if (byId) return byId;
  }
  const q = norm(query);
  if (!q) return null;

  const all = await Colaborador.findAll({ transaction });
  const exact = all.find((c) => norm(c.email) === q || norm(c.nombre) === q);
  if (exact) return exact;

  const matches = all.filter((c) => norm(c.nombre).includes(q) || norm(c.email).includes(q));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return { ambiguous: matches };
  return null;
}

async function handleGestionarSolicitud(args, rrhhUser) {
  const { accion, solicitud_id, colaborador_nombre, tipo_solicitud } = args;
  let targetSol = null;

  if (solicitud_id) {
    targetSol = await Solicitud.findByPk(Number(solicitud_id), {
      include: [{ model: Colaborador, as: 'colaborador', attributes: ['id', 'nombre', 'departamento', 'puesto', 'email'] }]
    });
  } else {
    const pendingList = await Solicitud.findAll({
      where: {
        estado: 'pendiente',
        ...(tipo_solicitud ? { tipo: tipo_solicitud } : {})
      },
      include: [
        {
          model: Colaborador,
          as: 'colaborador',
          attributes: ['id', 'nombre', 'departamento', 'puesto', 'email']
        }
      ],
      order: [['creada_en', 'ASC']]
    });

    const q = norm(colaborador_nombre);
    const matches = q
      ? pendingList.filter((s) => norm(s.colaborador?.nombre).includes(q))
      : pendingList;

    if (matches.length === 0) {
      return {
        ejecutada: false,
        error: q
          ? `No se encontraron solicitudes pendientes para "${colaborador_nombre}".`
          : 'No hay solicitudes pendientes que coincidan.'
      };
    }
    if (matches.length > 1 && !q) {
      return {
        ejecutada: false,
        error: 'Se requiere indicar el colaborador o el número de solicitud específica.',
        candidatos: matches.slice(0, 5).map((m) => ({
          id: m.id,
          colaborador: m.colaborador?.nombre,
          tipo: m.tipo,
          fechas: `${m.fecha_inicio} al ${m.fecha_fin}`
        }))
      };
    }
    targetSol = matches[0];
  }

  if (!targetSol) {
    return { ejecutada: false, error: 'Solicitud no encontrada.' };
  }

  if (targetSol.estado !== 'pendiente' && accion !== 'previsualizar') {
    return {
      ejecutada: false,
      error: `La solicitud #${targetSol.id} de ${targetSol.colaborador?.nombre} ya tiene estado "${targetSol.estado}".`
    };
  }

  const colab = targetSol.colaborador;
  const diasSolicitados = calculateRequestedDays(targetSol.fecha_inicio, targetSol.fecha_fin);

  const overlappingRows = await Solicitud.findAll({
    where: {
      id: { [Op.ne]: targetSol.id },
      estado: 'aprobada',
      fecha_inicio: { [Op.lte]: targetSol.fecha_fin },
      fecha_fin: { [Op.gte]: targetSol.fecha_inicio }
    },
    include: [
      {
        model: Colaborador,
        as: 'colaborador',
        where: { departamento: colab?.departamento || '' },
        attributes: ['id', 'nombre', 'puesto']
      }
    ]
  });

  const traslapes = overlappingRows.map((o) => ({
    colaborador: o.colaborador?.nombre,
    puesto: o.colaborador?.puesto,
    tipo: o.tipo,
    fechas: `${o.fecha_inicio} al ${o.fecha_fin}`
  }));

  const saldoActual = await SaldoVacaciones.findOne({
    where: { colaborador_id: targetSol.colaborador_id },
    order: [['periodo', 'DESC']]
  });

  if (accion === 'previsualizar') {
    const disponibles = Number(saldoActual?.dias_disponibles ?? 0);
    return {
      ejecutada: false,
      modo: 'previsualizacion',
      solicitud_id: targetSol.id,
      colaborador: colab?.nombre,
      departamento: colab?.departamento,
      puesto: colab?.puesto,
      tipo: targetSol.tipo,
      fecha_inicio: targetSol.fecha_inicio,
      fecha_fin: targetSol.fecha_fin,
      dias_solicitados: diasSolicitados,
      saldo_disponible_actual: disponibles,
      saldo_proyectado_tras_aprobar:
        targetSol.tipo === 'vacaciones'
          ? Number((disponibles - diasSolicitados).toFixed(2))
          : disponibles,
      traslapes_en_departamento: traslapes
    };
  }

  if (accion === 'rechazar') {
    const estadoAnterior = targetSol.estado;
    await sequelize.transaction(async (t) => {
      await targetSol.update(
        { estado: 'rechazada', aprobador_id: rrhhUser.id },
        { transaction: t }
      );
    });

    return {
      ejecutada: true,
      entidad: 'solicitud',
      accion: 'rechazar',
      solicitud_id: targetSol.id,
      colaborador: colab?.nombre,
      departamento: colab?.departamento,
      tipo: targetSol.tipo,
      fechas: `${targetSol.fecha_inicio} al ${targetSol.fecha_fin}`,
      antes: { estado: estadoAnterior },
      despues: { estado: 'rechazada', aprobador: rrhhUser.nombre }
    };
  }

  // accion === 'aprobar'
  const saldoResult = await sequelize.transaction(async (t) => {
    let saldoBefore = null;
    let saldoAfter = null;

    if (targetSol.tipo === 'vacaciones') {
      const saldoTx = await SaldoVacaciones.findOne({
        where: { colaborador_id: targetSol.colaborador_id },
        order: [['periodo', 'DESC']],
        transaction: t
      });

      const disp = Number(saldoTx?.dias_disponibles ?? 0);
      if (!saldoTx || disp < diasSolicitados) {
        return {
          insufficient: true,
          disponibles: disp,
          requeridos: diasSolicitados
        };
      }

      const tomados = Number(saldoTx.dias_tomados);
      const nuevosTomados = Number((tomados + diasSolicitados).toFixed(2));
      const nuevosDisp = Number((disp - diasSolicitados).toFixed(2));

      saldoBefore = { dias_tomados: tomados, dias_disponibles: disp };
      await saldoTx.update(
        { dias_tomados: nuevosTomados, dias_disponibles: nuevosDisp },
        { transaction: t }
      );
      saldoAfter = { dias_tomados: nuevosTomados, dias_disponibles: nuevosDisp };
    }

    await targetSol.update(
      { estado: 'aprobada', aprobador_id: rrhhUser.id },
      { transaction: t }
    );

    return { insufficient: false, saldoBefore, saldoAfter };
  });

  if (saldoResult.insufficient) {
    return {
      ejecutada: false,
      error: `Saldo insuficiente para ${colab?.nombre}: dispone de ${saldoResult.disponibles} días y la solicitud requiere ${saldoResult.requeridos} días hábiles.`
    };
  }

  return {
    ejecutada: true,
    entidad: 'solicitud',
    accion: 'aprobar',
    solicitud_id: targetSol.id,
    colaborador: colab?.nombre,
    departamento: colab?.departamento,
    tipo: targetSol.tipo,
    fechas: `${targetSol.fecha_inicio} al ${targetSol.fecha_fin}`,
    dias_descontados: targetSol.tipo === 'vacaciones' ? diasSolicitados : 0,
    traslapes_en_departamento: traslapes,
    antes: {
      estado: 'pendiente',
      ...(saldoResult.saldoBefore || {})
    },
    despues: {
      estado: 'aprobada',
      aprobador: rrhhUser.nombre,
      ...(saldoResult.saldoAfter || {})
    }
  };
}

async function handleGestionarColaborador(args, rrhhUser) {
  const {
    accion,
    colaborador_id,
    nombre_buscar,
    nombre,
    email,
    departamento,
    puesto,
    fecha_ingreso,
    rol,
    estado
  } = args;

  if (accion === 'crear') {
    if (!nombre || !email || !departamento || !puesto) {
      return {
        ejecutada: false,
        error: 'Para registrar un colaborador se requiere nombre completo, correo institucional, departamento y puesto.'
      };
    }

    const existing = await Colaborador.findOne({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return {
        ejecutada: false,
        error: `Ya existe un colaborador registrado con el correo ${email}.`
      };
    }

    const passwordHash = bcrypt.hashSync('NovaCore2026!', 10);
    const fechaIng = fecha_ingreso && /^\d{4}-\d{2}-\d{2}$/.test(fecha_ingreso)
      ? fecha_ingreso
      : todayIso();

    const createdResult = await sequelize.transaction(async (t) => {
      const created = await Colaborador.create(
        {
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          password_hash: passwordHash,
          departamento: departamento.trim(),
          puesto: puesto.trim(),
          fecha_ingreso: fechaIng,
          rol: rol || 'colaborador',
          estado: 'activo'
        },
        { transaction: t }
      );

      const saldo = await SaldoVacaciones.create(
        {
          colaborador_id: created.id,
          periodo: new Date().getFullYear(),
          dias_asignados: 15.0,
          dias_tomados: 0.0,
          dias_disponibles: 15.0
        },
        { transaction: t }
      );

      return { created, saldo };
    });

    return {
      ejecutada: true,
      entidad: 'colaborador',
      accion: 'crear',
      antes: null,
      despues: {
        id: createdResult.created.id,
        nombre: createdResult.created.nombre,
        email: createdResult.created.email,
        departamento: createdResult.created.departamento,
        puesto: createdResult.created.puesto,
        fecha_ingreso: createdResult.created.fecha_ingreso,
        rol: createdResult.created.rol,
        estado: createdResult.created.estado,
        saldo_vacaciones_inicial: Number(createdResult.saldo.dias_disponibles)
      }
    };
  }

  const target = await resolveColaborador({
    id: colaborador_id,
    query: nombre_buscar || nombre || email
  });

  if (!target) {
    return { ejecutada: false, error: 'No se encontró al colaborador indicado.' };
  }
  if (target.ambiguous) {
    return {
      ejecutada: false,
      error: 'Múltiples coincidencias encontradas. Especifica el nombre completo o correo.',
      coincidencias: target.ambiguous.map((c) => ({ nombre: c.nombre, departamento: c.departamento }))
    };
  }

  if (accion === 'desactivar' && target.id === rrhhUser.id) {
    return {
      ejecutada: false,
      error: 'No puedes desactivar tu propia cuenta administrativa mientras estás conectado.'
    };
  }

  const antes = {
    nombre: target.nombre,
    email: target.email,
    departamento: target.departamento,
    puesto: target.puesto,
    rol: target.rol,
    estado: target.estado
  };

  const updates = {};
  if (accion === 'desactivar') {
    updates.estado = 'inactivo';
  } else if (accion === 'reactivar') {
    updates.estado = 'activo';
  } else {
    if (nombre && nombre_buscar) updates.nombre = nombre.trim();
    if (email) updates.email = email.trim().toLowerCase();
    if (departamento) updates.departamento = departamento.trim();
    if (puesto) updates.puesto = puesto.trim();
    if (rol) updates.rol = rol;
    if (estado) updates.estado = estado;
  }

  if (Object.keys(updates).length === 0) {
    return { ejecutada: false, error: 'No se especificaron cambios para actualizar en el colaborador.' };
  }

  await sequelize.transaction(async (t) => {
    await target.update(updates, { transaction: t });
  });

  return {
    ejecutada: true,
    entidad: 'colaborador',
    accion,
    colaborador: target.nombre,
    antes,
    despues: {
      nombre: target.nombre,
      email: target.email,
      departamento: target.departamento,
      puesto: target.puesto,
      rol: target.rol,
      estado: target.estado
    }
  };
}

async function handleAjustarSaldo(args) {
  const { accion, colaborador_id, colaborador_nombre, dias } = args;
  const amount = Number(dias);
  if (Number.isNaN(amount) || amount < 0 || (accion !== 'fijar' && amount === 0)) {
    return { ejecutada: false, error: 'La cantidad de días debe ser un número positivo válido.' };
  }

  const target = await resolveColaborador({ id: colaborador_id, query: colaborador_nombre });
  if (!target) return { ejecutada: false, error: 'Colaborador no encontrado.' };
  if (target.ambiguous) {
    return {
      ejecutada: false,
      error: 'Múltiples colaboradores coinciden. Especifica el nombre completo.',
      coincidencias: target.ambiguous.map((c) => c.nombre)
    };
  }

  const txOutcome = await sequelize.transaction(async (t) => {
    let saldo = await SaldoVacaciones.findOne({
      where: { colaborador_id: target.id },
      order: [['periodo', 'DESC']],
      transaction: t
    });

    if (!saldo) {
      saldo = await SaldoVacaciones.create(
        {
          colaborador_id: target.id,
          periodo: new Date().getFullYear(),
          dias_asignados: 15.0,
          dias_tomados: 0.0,
          dias_disponibles: 15.0
        },
        { transaction: t }
      );
    }

    const antes = {
      periodo: saldo.periodo,
      dias_asignados: Number(saldo.dias_asignados),
      dias_tomados: Number(saldo.dias_tomados),
      dias_disponibles: Number(saldo.dias_disponibles)
    };

    let nuevosAsignados = antes.dias_asignados;
    let nuevosTomados = antes.dias_tomados;
    let nuevosDisponibles = antes.dias_disponibles;

    if (accion === 'acreditar') {
      nuevosAsignados = Number((antes.dias_asignados + amount).toFixed(2));
      nuevosDisponibles = Number((antes.dias_disponibles + amount).toFixed(2));
    } else if (accion === 'descontar') {
      if (antes.dias_disponibles < amount) {
        return {
          insufficient: true,
          disponibles: antes.dias_disponibles
        };
      }
      nuevosTomados = Number((antes.dias_tomados + amount).toFixed(2));
      nuevosDisponibles = Number((antes.dias_disponibles - amount).toFixed(2));
    } else if (accion === 'fijar') {
      nuevosDisponibles = Number(amount.toFixed(2));
      if (nuevosDisponibles + antes.dias_tomados !== antes.dias_asignados) {
        nuevosAsignados = Number((nuevosDisponibles + antes.dias_tomados).toFixed(2));
      }
    }

    await saldo.update(
      {
        dias_asignados: nuevosAsignados,
        dias_tomados: nuevosTomados,
        dias_disponibles: nuevosDisponibles
      },
      { transaction: t }
    );

    return {
      insufficient: false,
      antes,
      despues: {
        periodo: saldo.periodo,
        dias_asignados: nuevosAsignados,
        dias_tomados: nuevosTomados,
        dias_disponibles: nuevosDisponibles
      }
    };
  });

  if (txOutcome.insufficient) {
    return {
      ejecutada: false,
      error: `${target.nombre} solo dispone de ${txOutcome.disponibles} días y no es posible descontar ${amount}.`
    };
  }

  return {
    ejecutada: true,
    entidad: 'saldo_vacaciones',
    accion,
    colaborador: target.nombre,
    departamento: target.departamento,
    antes: txOutcome.antes,
    despues: txOutcome.despues
  };
}

async function handleRegistrarIncapacidad(args) {
  const {
    accion,
    incapacidad_id,
    colaborador_id,
    colaborador_nombre,
    entidad = 'CCSS',
    tipo = entidad === 'INS' ? 'riesgo_trabajo' : 'enfermedad_comun',
    fecha_inicio,
    fecha_fin,
    dias_totales
  } = args;

  if (accion === 'actualizar' && incapacidad_id) {
    const existing = await Incapacidad.findByPk(Number(incapacidad_id), {
      include: [{ model: Colaborador, as: 'colaborador', attributes: ['id', 'nombre', 'departamento'] }]
    });
    if (!existing) {
      return { ejecutada: false, error: 'Registro de incapacidad no encontrado.' };
    }

    const antes = {
      tipo: existing.tipo,
      entidad: existing.entidad,
      fecha_inicio: existing.fecha_inicio,
      dias: existing.dias
    };

    const nextStart = fecha_inicio || existing.fecha_inicio;
    const nextDias = dias_totales
      ? Number(dias_totales)
      : fecha_fin
        ? diffCalendarDaysInclusive(nextStart, fecha_fin)
        : existing.dias;
    const nextEntidad = entidad || existing.entidad;
    const nextTipo = tipo || existing.tipo;

    await sequelize.transaction(async (t) => {
      await existing.update(
        {
          tipo: nextTipo,
          entidad: nextEntidad,
          fecha_inicio: nextStart,
          dias: nextDias
        },
        { transaction: t }
      );
    });

    return {
      ejecutada: true,
      entidad: 'incapacidad',
      accion: 'actualizar',
      colaborador: existing.colaborador?.nombre,
      antes,
      despues: {
        id: existing.id,
        tipo: nextTipo,
        entidad: nextEntidad,
        fecha_inicio: nextStart,
        fecha_fin_calculada: addCalendarDaysIso(nextStart, nextDias - 1),
        dias: nextDias,
        porcentaje_subsidio: calculateSubsidyPolicy({ tipo: nextTipo, entidad: nextEntidad, dias: nextDias })
      }
    };
  }

  const target = await resolveColaborador({ id: colaborador_id, query: colaborador_nombre });
  if (!target) return { ejecutada: false, error: 'Colaborador no encontrado para registrar la incapacidad.' };
  if (target.ambiguous) {
    return {
      ejecutada: false,
      error: 'Múltiples colaboradores coinciden. Especifica el nombre completo.',
      coincidencias: target.ambiguous.map((c) => c.nombre)
    };
  }

  const startIso = fecha_inicio && /^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio) ? fecha_inicio : todayIso();
  const dias = dias_totales
    ? Math.max(1, Number(dias_totales))
    : fecha_fin
      ? Math.max(1, diffCalendarDaysInclusive(startIso, fecha_fin))
      : 1;

  const created = await sequelize.transaction(async (t) => {
    return Incapacidad.create(
      {
        colaborador_id: target.id,
        tipo,
        fecha_inicio: startIso,
        dias,
        entidad
      },
      { transaction: t }
    );
  });

  return {
    ejecutada: true,
    entidad: 'incapacidad',
    accion: 'crear',
    colaborador: target.nombre,
    departamento: target.departamento,
    antes: null,
    despues: {
      id: created.id,
      tipo: created.tipo,
      entidad: created.entidad,
      fecha_inicio: created.fecha_inicio,
      fecha_fin_calculada: addCalendarDaysIso(created.fecha_inicio, created.dias - 1),
      dias: created.dias,
      porcentaje_subsidio: calculateSubsidyPolicy({ tipo, entidad, dias })
    }
  };
}

async function handleResolverTicket(args, rrhhUser) {
  const { codigo, ticket_id, colaborador_nombre, respuesta_rrhh, estado = 'resuelto' } = args;
  let ticket = null;

  if (ticket_id) {
    ticket = await TicketRRHH.findByPk(Number(ticket_id), {
      include: [{ model: Colaborador, as: 'colaborador', attributes: ['id', 'nombre', 'departamento'] }]
    });
  } else if (codigo) {
    ticket = await TicketRRHH.findOne({
      where: { codigo: codigo.trim().toUpperCase() },
      include: [{ model: Colaborador, as: 'colaborador', attributes: ['id', 'nombre', 'departamento'] }]
    });
  } else {
    const allOpen = await TicketRRHH.findAll({
      where: { estado: { [Op.ne]: 'resuelto' } },
      include: [{ model: Colaborador, as: 'colaborador', attributes: ['id', 'nombre', 'departamento'] }],
      order: [['created_at', 'ASC']]
    });
    const q = norm(colaborador_nombre);
    ticket = q ? allOpen.find((t) => norm(t.colaborador?.nombre).includes(q)) : allOpen[0];
  }

  if (!ticket) {
    return { ejecutada: false, error: 'No se encontró ningún ticket escalado con ese criterio.' };
  }

  const antes = {
    codigo: ticket.codigo,
    estado: ticket.estado,
    respuesta_rrhh: ticket.respuesta_rrhh
  };

  await sequelize.transaction(async (t) => {
    await ticket.update(
      {
        estado,
        respuesta_rrhh: respuesta_rrhh.trim(),
        atendido_por: rrhhUser.id,
        resuelto_en: estado === 'resuelto' ? new Date() : null
      },
      { transaction: t }
    );
  });

  return {
    ejecutada: true,
    entidad: 'ticket_rrhh',
    accion: 'resolver',
    codigo: ticket.codigo,
    colaborador: ticket.colaborador?.nombre,
    consulta_original: ticket.consulta_original,
    antes,
    despues: {
      codigo: ticket.codigo,
      estado,
      respuesta_rrhh: respuesta_rrhh.trim(),
      atendido_por: rrhhUser.nombre
    }
  };
}

async function handleGestionarPalabraClave(args, invalidateCaches) {
  const { accion, id, palabra, categoria = 'tema_dashboard', tema_asociado = null } = args;
  const normalizedWord = String(palabra || '').trim().toLowerCase();

  if (!normalizedWord && !id) {
    return { ejecutada: false, error: 'Debe indicar la palabra clave o su ID.' };
  }

  if (accion === 'agregar') {
    const existingList = await PalabraClave.findAll();
    const dup = existingList.find(
      (k) => norm(k.palabra) === norm(normalizedWord) && k.categoria === categoria
    );
    if (dup) {
      if (!dup.activa) {
        await dup.update({ activa: true });
        if (invalidateCaches) invalidateCaches();
        return {
          ejecutada: true,
          entidad: 'palabra_clave',
          accion: 'reactivar',
          antes: { palabra: dup.palabra, activa: false },
          despues: { id: dup.id, palabra: dup.palabra, categoria: dup.categoria, activa: true }
        };
      }
      return {
        ejecutada: false,
        error: `La palabra clave "${dup.palabra}" ya existe activa en la categoría ${dup.categoria}.`
      };
    }

    const created = await sequelize.transaction(async (t) => {
      return PalabraClave.create(
        {
          palabra: normalizedWord,
          categoria,
          tema_asociado,
          activa: true
        },
        { transaction: t }
      );
    });
    if (invalidateCaches) invalidateCaches();

    return {
      ejecutada: true,
      entidad: 'palabra_clave',
      accion: 'agregar',
      antes: null,
      despues: {
        id: created.id,
        palabra: created.palabra,
        categoria: created.categoria,
        tema_asociado: created.tema_asociado,
        activa: created.activa
      }
    };
  }

  let target = id ? await PalabraClave.findByPk(Number(id)) : null;
  if (!target) {
    const all = await PalabraClave.findAll();
    target = all.find((k) => norm(k.palabra) === norm(normalizedWord));
  }

  if (!target) {
    return { ejecutada: false, error: `No se encontró la palabra clave "${palabra}".` };
  }

  const antes = {
    id: target.id,
    palabra: target.palabra,
    categoria: target.categoria,
    activa: Boolean(target.activa)
  };

  if (accion === 'eliminar') {
    await sequelize.transaction(async (t) => {
      await target.destroy({ transaction: t });
    });
    if (invalidateCaches) invalidateCaches();

    return {
      ejecutada: true,
      entidad: 'palabra_clave',
      accion: 'eliminar',
      antes,
      despues: null
    };
  }

  const nextActive = accion === 'activar';
  await sequelize.transaction(async (t) => {
    await target.update({ activa: nextActive }, { transaction: t });
  });
  if (invalidateCaches) invalidateCaches();

  return {
    ejecutada: true,
    entidad: 'palabra_clave',
    accion,
    antes,
    despues: {
      id: target.id,
      palabra: target.palabra,
      categoria: target.categoria,
      activa: nextActive
    }
  };
}

async function handleRegenerarReporte(args) {
  const { fecha } = args || {};
  const targetDate = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null;
  const reporte = await generateDailyReport(targetDate);
  const d = reporte.datos_json || {};

  return {
    ejecutada: true,
    entidad: 'reporte_diario',
    accion: 'regenerar',
    fecha: reporte.fecha,
    resumen_texto: reporte.resumen_texto,
    indicadores: {
      ausentes_hoy: d.ausentes_hoy?.total ?? 0,
      solicitudes_pendientes: d.solicitudes_pendientes?.total ?? 0,
      incapacidades_activas: d.incapacidades_mes?.activas_hoy ?? 0,
      riesgo_pasivo_mas_20d: d.riesgo_pasivo_vacaciones?.total_colaboradores ?? 0
    }
  };
}

async function executeToolCall(name, rawArgs, rrhhUser, invalidateCaches) {
  const args = typeof rawArgs === 'string' ? safeParseJson(rawArgs, {}) : rawArgs || {};

  switch (name) {
    case 'gestionar_solicitud':
      return handleGestionarSolicitud(args, rrhhUser);
    case 'gestionar_colaborador':
      return handleGestionarColaborador(args, rrhhUser);
    case 'ajustar_saldo_vacaciones':
      return handleAjustarSaldo(args);
    case 'registrar_incapacidad':
      return handleRegistrarIncapacidad(args);
    case 'resolver_ticket':
      return handleResolverTicket(args, rrhhUser);
    case 'gestionar_palabra_clave':
      return handleGestionarPalabraClave(args, invalidateCaches);
    case 'regenerar_reporte_diario':
      return handleRegenerarReporte(args);
    default:
      return { ejecutada: false, error: `Herramienta desconocida: ${name}` };
  }
}

async function buildLiveAdminSnapshot() {
  const [solicitudesPendientes, ticketsAbiertos, colaboradores] = await Promise.all([
    Solicitud.findAll({
      where: { estado: 'pendiente' },
      include: [{ model: Colaborador, as: 'colaborador', attributes: ['id', 'nombre', 'departamento'] }],
      order: [['creada_en', 'ASC']]
    }),
    TicketRRHH.findAll({
      where: { estado: { [Op.ne]: 'resuelto' } },
      include: [{ model: Colaborador, as: 'colaborador', attributes: ['id', 'nombre', 'departamento'] }],
      order: [['created_at', 'ASC']]
    }),
    Colaborador.findAll({
      attributes: ['id', 'nombre', 'email', 'departamento', 'puesto', 'estado'],
      raw: true
    })
  ]);

  return {
    fecha_actual: todayIso(),
    solicitudes_pendientes: solicitudesPendientes.map((s) => ({
      id: s.id,
      colaborador: s.colaborador?.nombre,
      departamento: s.colaborador?.departamento,
      tipo: s.tipo,
      fecha_inicio: s.fecha_inicio,
      fecha_fin: s.fecha_fin
    })),
    tickets_abiertos: ticketsAbiertos.map((t) => ({
      id: t.id,
      codigo: t.codigo,
      estado: t.estado,
      colaborador: t.colaborador?.nombre,
      consulta: String(t.consulta_original || '').slice(0, 140)
    })),
    directorio_colaboradores: colaboradores
  };
}

async function runAccionRrhhAgent(pregunta, user, historial = [], { invalidateCaches } = {}) {
  const [recentDbLogs, snapshot] = await Promise.all([
    ConsultaChat.findAll({
      where: { colaborador_id: user.id },
      order: [['fecha', 'DESC']],
      limit: 4,
      raw: true
    }),
    buildLiveAdminSnapshot()
  ]);

  const dbTurnsText = recentDbLogs
    .slice()
    .reverse()
    .map((l) => `- [${l.intencion}/${l.agente}] "${l.pregunta}"`)
    .join('\n');

  const contextMessage = [
    `USUARIO EJECUTOR (rol=rrhh): ${user.nombre} (${user.email})`,
    dbTurnsText ? `ÚLTIMAS CONSULTAS DEL USUARIO EN SISTEMA:\n${dbTurnsText}` : '',
    `ESTADO OPERATIVO ACTUAL DE REFERENCIA:\n${JSON.stringify(snapshot)}`
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages = [
    { role: 'system', content: `${ADMIN_SYSTEM_PROMPT}\n\n${contextMessage}` }
  ];

  if (Array.isArray(historial) && historial.length > 0) {
    for (const turn of historial.slice(-4)) {
      messages.push({
        role: turn.role === 'assistant' ? 'assistant' : 'user',
        content: String(turn.content || '').slice(0, 1200)
      });
    }
  }

  messages.push({ role: 'user', content: pregunta });

  const executedRecords = [];
  let anyMutationExecuted = false;
  let finalReply = '';

  for (let step = 0; step < 3; step += 1) {
    const assistantMsg = await chatWithTools({
      messages,
      tools: ACTION_TOOLS,
      temperature: 0,
      toolChoice: step === 0 ? 'auto' : 'auto',
      maxTokens: 900
    });

    const toolCalls = Array.isArray(assistantMsg.tool_calls) ? assistantMsg.tool_calls : [];
    if (toolCalls.length === 0) {
      finalReply = String(assistantMsg.content || '').trim();
      break;
    }

    messages.push({
      role: 'assistant',
      content: assistantMsg.content || '',
      tool_calls: toolCalls
    });

    for (const tc of toolCalls) {
      const outcome = await executeToolCall(
        tc.function?.name,
        tc.function?.arguments,
        user,
        invalidateCaches
      );
      if (outcome && outcome.ejecutada === true) {
        anyMutationExecuted = true;
      }
      executedRecords.push({
        herramienta: tc.function?.name,
        resultado: outcome
      });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(outcome)
      });
    }
  }

  if (!finalReply) {
    const lastTurn = await chatWithTools({
      messages,
      tools: undefined,
      temperature: 0.1,
      maxTokens: 700
    });
    finalReply = String(lastTurn.content || '').trim();
  }

  return {
    respuesta: finalReply,
    accionEjecutada: anyMutationExecuted,
    evidencia: JSON.stringify({
      snapshot_fecha: snapshot.fecha_actual,
      acciones_evaluadas: executedRecords
    })
  };
}

module.exports = {
  runAccionRrhhAgent
};

