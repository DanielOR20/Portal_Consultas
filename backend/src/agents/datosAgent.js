'use strict';

const { Op } = require('sequelize');
const {
  Colaborador,
  SaldoVacaciones,
  Solicitud,
  Incapacidad,
  TicketRRHH,
  ReporteDiario
} = require('../models');
const { chatCompletion } = require('../config/llmClient');

const SYSTEM_PROMPT = `Eres el Agente de Datos Personales del Colaborador de NovaCore Technologies Costa Rica S.A.
Tu función es responder la consulta del colaborador autenticado utilizando ÚNICAMENTE los datos verificados en el objeto JSON de contexto proveniente de MySQL.

REGLAS ESTRICTAS:
1. Usa exclusivamente los números, fechas y estados presentes en el JSON proporcionado. No inventes ni estimes cifras.
2. Si el contexto no contiene datos de terceros o salarios individuales, explica que solo tienes acceso a los datos del colaborador autenticado (o métricas agregadas si es usuario RRHH).
3. Cuando el usuario tenga rol "rrhh" y el contexto incluya resumen_agregado_empresa_rrhh, utiliza también los conteos de tickets escalados abiertos, las solicitudes pendientes más antiguas y el último resumen ejecutivo diario si la consulta los requiere.
4. Responde en español con tono amable, claro, directo y profesional.`;

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function adjustToPreviousBusinessDay(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = copy.getDay();
  if (dayOfWeek === 6) {
    copy.setDate(copy.getDate() - 1);
  } else if (dayOfWeek === 0) {
    copy.setDate(copy.getDate() - 2);
  }
  return copy;
}

function calcularProximoPagoQuincenal(hoy = new Date()) {
  const todayMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const year = todayMidnight.getFullYear();
  const month = todayMidnight.getMonth();

  const pago15 = adjustToPreviousBusinessDay(new Date(year, month, 15));
  const ultimoDiaMes = adjustToPreviousBusinessDay(new Date(year, month + 1, 0));

  if (todayMidnight <= pago15) {
    return {
      fecha_pago: formatDate(pago15),
      quincena: 'Primera quincena (día 15)',
      regla: 'Los salarios se pagan el día 15 y el último día hábil de cada mes (si coincide con fin de semana, se adelanta al día hábil anterior).'
    };
  }

  if (todayMidnight <= ultimoDiaMes) {
    return {
      fecha_pago: formatDate(ultimoDiaMes),
      quincena: 'Segunda quincena (último día hábil del mes)',
      regla: 'Los salarios se pagan el día 15 y el último día hábil de cada mes (si coincide con fin de semana, se adelanta al día hábil anterior).'
    };
  }

  const siguiente15 = adjustToPreviousBusinessDay(new Date(year, month + 1, 15));
  return {
    fecha_pago: formatDate(siguiente15),
    quincena: 'Primera quincena del mes siguiente (día 15)',
    regla: 'Los salarios se pagan el día 15 y el último día hábil de cada mes.'
  };
}

function calcularProximaEvaluacion(fechaIngresoStr, hoy = new Date()) {
  const todayMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const ingreso = new Date(`${fechaIngresoStr}T00:00:00`);
  const diffDays = Math.floor((todayMidnight - ingreso) / (1000 * 60 * 60 * 24));
  const enPeriodoPrueba = diffDays < 90;

  const finPrueba = new Date(ingreso.getTime());
  finPrueba.setDate(finPrueba.getDate() + 90);

  const month = todayMidnight.getMonth(); // 0=ene ... 5=jun ... 11=dic
  const year = todayMidnight.getFullYear();
  const ventanaSemestral = month <= 5 ? `Junio ${year}` : `Diciembre ${year}`;

  return {
    antiguedad_dias: diffDays,
    en_periodo_prueba: enPeriodoPrueba,
    fecha_fin_periodo_prueba: formatDate(finPrueba),
    proxima_evaluacion_semestral: ventanaSemestral,
    regla_evaluacion:
      'Las evaluaciones de desempeño semestrales se realizan en junio y diciembre; los nuevos ingresos tienen periodo de prueba de 90 días (3 meses).'
  };
}

async function getAgregadosEmpresa(hoyStr) {
  const [
    totalActivos,
    vacacionesHoy,
    teletrabajoHoy,
    permisosHoy,
    solicitudesPendientes,
    colaboradoresPasivoAlto,
    incapacidadesActivasRaw,
    ticketsAbiertosCount,
    solicitudesAntiguasRaw,
    ultimoReporte
  ] = await Promise.all([
    Colaborador.count({ where: { estado: 'activo' } }),
    Solicitud.count({
      where: {
        tipo: 'vacaciones',
        estado: 'aprobada',
        fecha_inicio: { [Op.lte]: hoyStr },
        fecha_fin: { [Op.gte]: hoyStr }
      }
    }),
    Solicitud.count({
      where: {
        tipo: 'teletrabajo',
        estado: 'aprobada',
        fecha_inicio: { [Op.lte]: hoyStr },
        fecha_fin: { [Op.gte]: hoyStr }
      }
    }),
    Solicitud.count({
      where: {
        tipo: { [Op.in]: ['permiso_con_goce', 'permiso_sin_goce'] },
        estado: 'aprobada',
        fecha_inicio: { [Op.lte]: hoyStr },
        fecha_fin: { [Op.gte]: hoyStr }
      }
    }),
    Solicitud.count({ where: { estado: 'pendiente' } }),
    SaldoVacaciones.count({ where: { dias_disponibles: { [Op.gt]: 20 } } }),
    Incapacidad.findAll({
      attributes: ['fecha_inicio', 'dias', 'tipo', 'entidad'],
      raw: true
    }),
    TicketRRHH.count({ where: { estado: 'abierto' } }),
    Solicitud.findAll({
      where: { estado: 'pendiente' },
      include: [
        {
          model: Colaborador,
          as: 'colaborador',
          attributes: ['nombre', 'departamento']
        }
      ],
      order: [['creada_en', 'ASC']],
      limit: 5
    }),
    ReporteDiario.findOne({
      order: [['fecha', 'DESC']],
      attributes: ['fecha', 'resumen_texto'],
      raw: true
    })
  ]);

  const hoyDate = new Date(`${hoyStr}T00:00:00`);
  const incapacidadesActivasHoy = incapacidadesActivasRaw.filter((inc) => {
    const start = new Date(`${inc.fecha_inicio}T00:00:00`);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + Number(inc.dias) - 1);
    return start <= hoyDate && hoyDate <= end;
  }).length;

  const solicitudesPendientesMasAntiguas = solicitudesAntiguasRaw.map((sol) => ({
    id: sol.id,
    colaborador: sol.colaborador?.nombre || 'N/D',
    departamento: sol.colaborador?.departamento || 'N/D',
    tipo: sol.tipo,
    fecha_inicio: sol.fecha_inicio,
    fecha_fin: sol.fecha_fin,
    creada_en: sol.creada_en
  }));

  return {
    fecha_consulta: hoyStr,
    colaboradores_activos: totalActivos,
    de_vacaciones_hoy: vacacionesHoy,
    en_teletrabajo_aprobado_hoy: teletrabajoHoy,
    con_permiso_hoy: permisosHoy,
    incapacidades_activas_hoy: incapacidadesActivasHoy,
    solicitudes_pendientes_totales: solicitudesPendientes,
    solicitudes_pendientes_mas_antiguas: solicitudesPendientesMasAntiguas,
    tickets_escalados_abiertos: ticketsAbiertosCount,
    colaboradores_con_mas_de_20_dias_vacaciones: colaboradoresPasivoAlto,
    ultimo_resumen_diario: ultimoReporte
      ? { fecha: ultimoReporte.fecha, resumen_texto: ultimoReporte.resumen_texto }
      : null
  };
}

async function runDatosAgent(pregunta, user, historial = []) {
  const hoy = new Date();
  const hoyStr = formatDate(hoy);

  // Consultas estrictamente filtradas por colaborador_id = user.id
  const [colaborador, saldoActual, solicitudesRecientes, incapacidadesRegistradas] =
    await Promise.all([
      Colaborador.findByPk(user.id, {
        attributes: ['id', 'nombre', 'email', 'departamento', 'puesto', 'fecha_ingreso', 'rol', 'estado'],
        include: [
          {
            model: Colaborador,
            as: 'jefe',
            attributes: ['nombre', 'email', 'puesto']
          }
        ]
      }),
      SaldoVacaciones.findOne({
        where: { colaborador_id: user.id },
        order: [['periodo', 'DESC']]
      }),
      Solicitud.findAll({
        where: { colaborador_id: user.id },
        order: [['creada_en', 'DESC']],
        limit: 10,
        raw: true
      }),
      Incapacidad.findAll({
        where: { colaborador_id: user.id },
        order: [['fecha_inicio', 'DESC']],
        limit: 10,
        raw: true
      })
    ]);

  const contextoDatos = {
    fecha_actual: hoyStr,
    perfil_propio: colaborador ? colaborador.toJSON() : null,
    saldo_vacaciones_propio: saldoActual ? saldoActual.toJSON() : null,
    solicitudes_propias: solicitudesRecientes,
    incapacidades_propias: incapacidadesRegistradas,
    proximo_pago_quincenal: calcularProximoPagoQuincenal(hoy),
    evaluacion_y_prueba: colaborador
      ? calcularProximaEvaluacion(colaborador.fecha_ingreso, hoy)
      : null
  };

  // Regla estricta RRHH: solo agregados globales si user.rol === 'rrhh'
  if (user.rol === 'rrhh') {
    contextoDatos.resumen_agregado_empresa_rrhh = await getAgregadosEmpresa(hoyStr);
  }

  const historialText = Array.isArray(historial) && historial.length > 0
    ? historial
        .slice(-4)
        .map((m) => `${m.role === 'assistant' ? 'Asistente' : 'Colaborador'}: ${m.content}`)
        .join('\n')
    : '';

  const userPrompt = [
    historialText ? `HISTORIAL RECIENTE:\n${historialText}\n` : '',
    `PREGUNTA DEL USUARIO (rol=${user.rol}):\n${pregunta}`,
    `\nDATOS VERIFICADOS DE MYSQL (JSON):\n${JSON.stringify(contextoDatos, null, 2)}`
  ]
    .filter(Boolean)
    .join('\n');

  const respuesta = await chatCompletion({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.1,
    jsonMode: false
  });

  return {
    respuesta: respuesta.trim(),
    contextoDatos
  };
}

module.exports = {
  runDatosAgent,
  calcularProximoPagoQuincenal,
  calcularProximaEvaluacion
};

