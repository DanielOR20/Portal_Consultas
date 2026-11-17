'use strict';

const bcrypt = require('bcryptjs');
const { Colaborador } = require('../models');

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(baseDate, days) {
  const copy = new Date(baseDate.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const existingCount = await Colaborador.count({
      where: { email: 'laura.mendez@novacore.cr' }
    });
    if (existingCount > 0) {
      console.log('Seeder ya ejecutado previamente. Omitiendo inserción duplicada.');
      return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const passwordHash = await bcrypt.hash('NovaCore2026!', 10);

    // 1. Definir los 55 colaboradores ficticios (6 jefaturas + 49 colaboradores)
    // Exactamente 3 con rol 'rrhh' y 52 con rol 'colaborador'
    const jefaturasData = [
      {
        nombre: 'Laura Méndez Quesada',
        email: 'laura.mendez@novacore.cr',
        departamento: 'Talento Humano',
        puesto: 'Directora de Talento Humano',
        fecha_ingreso: '2020-03-15',
        rol: 'rrhh',
        estado: 'activo'
      },
      {
        nombre: 'Alejandro Vargas Mora',
        email: 'alejandro.vargas@novacore.cr',
        departamento: 'Ingeniería',
        puesto: 'Director de Ingeniería',
        fecha_ingreso: '2019-11-01',
        rol: 'colaborador',
        estado: 'activo'
      },
      {
        nombre: 'Sofía Chinchilla Rojas',
        email: 'sofia.chinchilla@novacore.cr',
        departamento: 'Producto',
        puesto: 'Gerente de Producto',
        fecha_ingreso: '2021-02-10',
        rol: 'colaborador',
        estado: 'activo'
      },
      {
        nombre: 'Rodrigo Alfaro Jiménez',
        email: 'rodrigo.alfaro@novacore.cr',
        departamento: 'Operaciones',
        puesto: 'Gerente de Operaciones',
        fecha_ingreso: '2020-08-18',
        rol: 'colaborador',
        estado: 'activo'
      },
      {
        nombre: 'Valeria SotoBrenes',
        email: 'valeria.soto@novacore.cr',
        departamento: 'Ventas',
        puesto: 'Directora Comercial B2B',
        fecha_ingreso: '2021-05-03',
        rol: 'colaborador',
        estado: 'activo'
      },
      {
        nombre: 'Esteban Calderón Núñez',
        email: 'esteban.calderon@novacore.cr',
        departamento: 'Finanzas',
        puesto: 'Director Financiero',
        fecha_ingreso: '2020-01-20',
        rol: 'colaborador',
        estado: 'activo'
      }
    ];

    // Corregir espacio en nombre Valeria Soto Brenes
    jefaturasData[4].nombre = 'Valeria Soto Brenes';

    await queryInterface.bulkInsert(
      'colaboradores',
      jefaturasData.map((j) => ({
        ...j,
        password_hash: passwordHash,
        jefe_id: null,
        created_at: now,
        updated_at: now
      }))
    );

    const jefesRows = await Colaborador.findAll({
      attributes: ['id', 'departamento', 'email'],
      order: [['id', 'ASC']],
      raw: true
    });
    const jefePorDepto = {};
    for (const row of jefesRows) {
      jefePorDepto[row.departamento] = row.id;
    }

    const colaboradoresRestantes = [
      // Ingeniería (15 adicionales -> 16 total)
      { nombre: 'Carlos Solano Chaves', email: 'carlos.solano@novacore.cr', departamento: 'Ingeniería', puesto: 'Desarrollador Full-Stack Senior', fecha_ingreso: '2022-04-11', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Daniela Araya Fallas', email: 'daniela.araya@novacore.cr', departamento: 'Ingeniería', puesto: 'Ingeniera Backend Node.js', fecha_ingreso: '2023-01-16', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Mateo Herrera Campos', email: 'mateo.herrera@novacore.cr', departamento: 'Ingeniería', puesto: 'Arquitecto Cloud', fecha_ingreso: '2021-09-06', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Camila Valverde Picado', email: 'camila.valverde@novacore.cr', departamento: 'Ingeniería', puesto: 'Ingeniera Frontend React', fecha_ingreso: '2023-06-12', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Andrés Salazar Ulate', email: 'andres.salazar@novacore.cr', departamento: 'Ingeniería', puesto: 'Ingeniero DevOps', fecha_ingreso: '2022-10-03', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Lucía Monge Madrigal', email: 'lucia.monge@novacore.cr', departamento: 'Ingeniería', puesto: 'Ingeniera QA Automation', fecha_ingreso: '2024-02-05', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Gabriel Zamora Céspedes', email: 'gabriel.zamora@novacore.cr', departamento: 'Ingeniería', puesto: 'Ingeniero de Datos & IA', fecha_ingreso: '2023-08-21', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Paula Quirós Segura', email: 'paula.quiros@novacore.cr', departamento: 'Ingeniería', puesto: 'Desarrolladora Backend', fecha_ingreso: '2024-05-13', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Sebastián Conejo Arias', email: 'sebastian.conejo@novacore.cr', departamento: 'Ingeniería', puesto: 'Ingeniero de Seguridad', fecha_ingreso: '2022-07-18', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Natalia Guzmán Barboza', email: 'natalia.guzman@novacore.cr', departamento: 'Ingeniería', puesto: 'Desarrolladora Frontend', fecha_ingreso: formatDate(addDays(today, -45)), rol: 'colaborador', estado: 'activo' },
      { nombre: 'Diego Cordero Villalobos', email: 'diego.cordero@novacore.cr', departamento: 'Ingeniería', puesto: 'Tech Lead Plataforma', fecha_ingreso: '2021-03-22', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Mariana Elizondo Bolaños', email: 'mariana.elizondo@novacore.cr', departamento: 'Ingeniería', puesto: 'Analista QA', fecha_ingreso: '2024-08-19', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Felipe Chacón Porras', email: 'felipe.chacon@novacore.cr', departamento: 'Ingeniería', puesto: 'Ingeniero SRE', fecha_ingreso: '2023-03-06', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Rebeca Alvarado Mata', email: 'rebeca.alvarado@novacore.cr', departamento: 'Ingeniería', puesto: 'Desarrolladora Junior', fecha_ingreso: formatDate(addDays(today, -25)), rol: 'colaborador', estado: 'activo' },
      { nombre: 'Tomás Hidalgo Castro', email: 'tomas.hidalgo@novacore.cr', departamento: 'Ingeniería', puesto: 'Desarrollador Backend', fecha_ingreso: '2022-11-14', rol: 'colaborador', estado: 'inactivo' },

      // Producto (7 adicionales -> 8 total)
      { nombre: 'Elena Rodríguez Vega', email: 'elena.rodriguez@novacore.cr', departamento: 'Producto', puesto: 'Product Manager Senior', fecha_ingreso: '2022-01-10', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Julián Ramírez Murillo', email: 'julian.ramirez@novacore.cr', departamento: 'Producto', puesto: 'Diseñador UX/UI Senior', fecha_ingreso: '2022-06-20', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Mónica Navarro Sibaja', email: 'monica.navarro@novacore.cr', departamento: 'Producto', puesto: 'Product Owner', fecha_ingreso: '2023-04-17', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Ignacio Quesada Carvajal', email: 'ignacio.quesada@novacore.cr', departamento: 'Producto', puesto: 'UX Researcher', fecha_ingreso: '2024-01-08', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Adriana Salas Víquez', email: 'adriana.salas@novacore.cr', departamento: 'Producto', puesto: 'Product Designer', fecha_ingreso: '2023-09-11', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Mauricio León Benavides', email: 'mauricio.leon@novacore.cr', departamento: 'Producto', puesto: 'Product Analyst', fecha_ingreso: formatDate(addDays(today, -60)), rol: 'colaborador', estado: 'activo' },
      { nombre: 'Karla Obando Barrantes', email: 'karla.obando@novacore.cr', departamento: 'Producto', puesto: 'Technical Writer', fecha_ingreso: '2024-04-01', rol: 'colaborador', estado: 'activo' },

      // Operaciones (9 adicionales -> 10 total)
      { nombre: 'Roberto Jiménez Solís', email: 'roberto.jimenez@novacore.cr', departamento: 'Operaciones', puesto: 'Coordinador de Soporte B2B', fecha_ingreso: '2021-07-05', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Tatiana Gómez Arce', email: 'tatiana.gomez@novacore.cr', departamento: 'Operaciones', puesto: 'Especialista de Implementación', fecha_ingreso: '2022-08-15', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Óscar Fonseca Sancho', email: 'oscar.fonseca@novacore.cr', departamento: 'Operaciones', puesto: 'Administrador de Infraestructura TI', fecha_ingreso: '2022-03-07', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Silvia Madrigal Umaña', email: 'silvia.madrigal@novacore.cr', departamento: 'Operaciones', puesto: 'Especialista de Soporte Técnico', fecha_ingreso: '2023-10-02', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Kevin Morales Granados', email: 'kevin.morales@novacore.cr', departamento: 'Operaciones', puesto: 'Analista de Operaciones', fecha_ingreso: '2024-03-18', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Grettel Arias Calvo', email: 'grettel.arias@novacore.cr', departamento: 'Operaciones', puesto: 'Coordinadora de Salud Ocupacional', fecha_ingreso: '2022-09-12', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Brayan Vindas Esquivel', email: 'brayan.vindas@novacore.cr', departamento: 'Operaciones', puesto: 'Especialista Service Desk', fecha_ingreso: formatDate(addDays(today, -35)), rol: 'colaborador', estado: 'activo' },
      { nombre: 'Melissa Cruz Corrales', email: 'melissa.cruz@novacore.cr', departamento: 'Operaciones', puesto: 'Analista de Cumplimiento', fecha_ingreso: '2023-05-22', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Héctor Murillo Venegas', email: 'hector.murillo@novacore.cr', departamento: 'Operaciones', puesto: 'Especialista de Soporte N2', fecha_ingreso: '2023-02-13', rol: 'colaborador', estado: 'inactivo' },

      // Ventas (8 adicionales -> 9 total)
      { nombre: 'Fabiola Piedra Serrano', email: 'fabiola.piedra@novacore.cr', departamento: 'Ventas', puesto: 'Ejecutiva de Cuentas Enterprise', fecha_ingreso: '2021-10-18', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Christian Bermúdez Rojas', email: 'christian.bermudez@novacore.cr', departamento: 'Ventas', puesto: 'Account Executive B2B', fecha_ingreso: '2022-12-05', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Priscila Zúñiga Valverde', email: 'priscila.zuniga@novacore.cr', departamento: 'Ventas', puesto: 'Customer Success Manager', fecha_ingreso: '2023-01-23', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Randall Aguilar Oviedo', email: 'randall.aguilar@novacore.cr', departamento: 'Ventas', puesto: 'Sales Development Representative', fecha_ingreso: '2024-06-10', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Jimena Torres Ureña', email: 'jimena.torres@novacore.cr', departamento: 'Ventas', puesto: 'Account Executive Mid-Market', fecha_ingreso: '2023-07-03', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Luis Fernando Campos Díaz', email: 'luis.campos@novacore.cr', departamento: 'Ventas', puesto: 'Solutions Consultant', fecha_ingreso: '2022-05-09', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Pamela Cortés Ramírez', email: 'pamela.cortes@novacore.cr', departamento: 'Ventas', puesto: 'Sales Development Representative', fecha_ingreso: formatDate(addDays(today, -18)), rol: 'colaborador', estado: 'activo' },
      { nombre: 'Marco Vinicio Méndez López', email: 'marco.mendez@novacore.cr', departamento: 'Ventas', puesto: 'Ejecutivo Comercial', fecha_ingreso: '2023-11-06', rol: 'colaborador', estado: 'inactivo' },

      // Finanzas (5 adicionales -> 6 total)
      { nombre: 'Irene Víquez Monestel', email: 'irene.viquez@novacore.cr', departamento: 'Finanzas', puesto: 'Jefa de Contabilidad y Nómina', fecha_ingreso: '2020-11-09', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Gustavo Paniagua Chavarría', email: 'gustavo.paniagua@novacore.cr', departamento: 'Finanzas', puesto: 'Analista Financiero Senior', fecha_ingreso: '2022-02-14', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Cindy Quirós Mesén', email: 'cindy.quiros@novacore.cr', departamento: 'Finanzas', puesto: 'Especialista de Planilla', fecha_ingreso: '2023-03-27', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Arturo Brenes Delgado', email: 'arturo.brenes@novacore.cr', departamento: 'Finanzas', puesto: 'Contador General', fecha_ingreso: '2021-08-02', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Yendry Solórzano Mena', email: 'yendry.solorzano@novacore.cr', departamento: 'Finanzas', puesto: 'Analista de Facturación', fecha_ingreso: '2024-07-08', rol: 'colaborador', estado: 'activo' },

      // Talento Humano (5 adicionales -> 6 total; 2 con rol 'rrhh' + Laura = 3 rrhh en total)
      { nombre: 'Carolina Pacheco Sibaja', email: 'carolina.pacheco@novacore.cr', departamento: 'Talento Humano', puesto: 'Especialista Senior de RRHH', fecha_ingreso: '2021-06-14', rol: 'rrhh', estado: 'activo' },
      { nombre: 'Javier Montoya Zamora', email: 'javier.montoya@novacore.cr', departamento: 'Talento Humano', puesto: 'Analista de Nómina y Beneficios', fecha_ingreso: '2022-09-05', rol: 'rrhh', estado: 'activo' },
      { nombre: 'Diana Ureña González', email: 'diana.urena@novacore.cr', departamento: 'Talento Humano', puesto: 'Especialista de Adquisición de Talento', fecha_ingreso: '2023-05-15', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Pablo Céspedes Rojas', email: 'pablo.cespedes@novacore.cr', departamento: 'Talento Humano', puesto: 'Coordinador de Capacitación y Cultura', fecha_ingreso: '2023-10-16', rol: 'colaborador', estado: 'activo' },
      { nombre: 'Fiorella Camacho Vargas', email: 'fiorella.camacho@novacore.cr', departamento: 'Talento Humano', puesto: 'Asistente de Talento Humano', fecha_ingreso: '2024-09-02', rol: 'colaborador', estado: 'activo' }
    ];

    await queryInterface.bulkInsert(
      'colaboradores',
      colaboradoresRestantes.map((c) => ({
        ...c,
        password_hash: passwordHash,
        jefe_id: jefePorDepto[c.departamento],
        created_at: now,
        updated_at: now
      }))
    );

    const allCols = await Colaborador.findAll({
      attributes: ['id', 'nombre', 'email', 'departamento', 'fecha_ingreso', 'jefe_id', 'rol', 'estado'],
      order: [['id', 'ASC']],
      raw: true
    });
    const colByEmail = {};
    for (const c of allCols) {
      colByEmail[c.email] = c;
    }

    // 2. saldos_vacaciones para los 55 colaboradores (al menos 6 con > 20 días disponibles)
    const emailsPasivoAlto = new Set([
      'alejandro.vargas@novacore.cr',
      'diego.cordero@novacore.cr',
      'mateo.herrera@novacore.cr',
      'roberto.jimenez@novacore.cr',
      'fabiola.piedra@novacore.cr',
      'irene.viquez@novacore.cr',
      'arturo.brenes@novacore.cr',
      'elena.rodriguez@novacore.cr'
    ]);

    const saldosData = allCols.map((col, idx) => {
      if (emailsPasivoAlto.has(col.email)) {
        const disponibles = [24.5, 22.0, 23.5, 21.5, 25.0, 22.5, 21.0, 23.0][
          Array.from(emailsPasivoAlto).indexOf(col.email)
        ];
        const tomados = 4.0;
        const asignados = disponibles + tomados;
        return {
          colaborador_id: col.id,
          periodo: 2026,
          dias_asignados: asignados,
          dias_tomados: tomados,
          dias_disponibles: disponibles
        };
      }

      if (col.email === 'carlos.solano@novacore.cr') {
        return {
          colaborador_id: col.id,
          periodo: 2026,
          dias_asignados: 15.0,
          dias_tomados: 4.0,
          dias_disponibles: 11.0
        };
      }

      const asignados = 15.0;
      const tomados = Number(((idx % 7) * 1.5).toFixed(2));
      const disponibles = Number(Math.max(1.5, asignados - tomados).toFixed(2));
      return {
        colaborador_id: col.id,
        periodo: 2026,
        dias_asignados: asignados,
        dias_tomados: tomados,
        dias_disponibles: disponibles
      };
    });

    await queryInterface.bulkInsert('saldos_vacaciones', saldosData);

    // 3. solicitudes (últimos 3 meses: aprobadas activas hoy, >= 5 pendientes > 3 días, historial)
    const solicitudesData = [
      // Aprobadas activas HOY
      {
        colaborador_id: colByEmail['daniela.araya@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, -2)),
        fecha_fin: formatDate(addDays(today, 2)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Ingeniería'],
        creada_en: addDays(today, -18)
      },
      {
        colaborador_id: colByEmail['julian.ramirez@novacore.cr'].id,
        tipo: 'teletrabajo',
        fecha_inicio: formatDate(today),
        fecha_fin: formatDate(addDays(today, 1)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Producto'],
        creada_en: addDays(today, -5)
      },
      {
        colaborador_id: colByEmail['tatiana.gomez@novacore.cr'].id,
        tipo: 'permiso_con_goce',
        fecha_inicio: formatDate(addDays(today, -1)),
        fecha_fin: formatDate(addDays(today, 1)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Operaciones'],
        creada_en: addDays(today, -12)
      },
      {
        colaborador_id: colByEmail['luis.campos@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, -3)),
        fecha_fin: formatDate(addDays(today, 1)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Ventas'],
        creada_en: addDays(today, -20)
      },

      // Pendientes creadas hace MÁS DE 3 DÍAS (7 solicitudes para indicador de atraso)
      {
        colaborador_id: colByEmail['carlos.solano@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, 18)),
        fecha_fin: formatDate(addDays(today, 22)),
        estado: 'pendiente',
        aprobador_id: jefePorDepto['Ingeniería'],
        creada_en: addDays(today, -6)
      },
      {
        colaborador_id: colByEmail['camila.valverde@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, 20)),
        fecha_fin: formatDate(addDays(today, 24)),
        estado: 'pendiente',
        aprobador_id: jefePorDepto['Ingeniería'],
        creada_en: addDays(today, -8)
      },
      {
        colaborador_id: colByEmail['monica.navarro@novacore.cr'].id,
        tipo: 'permiso_sin_goce',
        fecha_inicio: formatDate(addDays(today, 30)),
        fecha_fin: formatDate(addDays(today, 45)),
        estado: 'pendiente',
        aprobador_id: jefePorDepto['Producto'],
        creada_en: addDays(today, -5)
      },
      {
        colaborador_id: colByEmail['kevin.morales@novacore.cr'].id,
        tipo: 'teletrabajo',
        fecha_inicio: formatDate(addDays(today, 4)),
        fecha_fin: formatDate(addDays(today, 6)),
        estado: 'pendiente',
        aprobador_id: jefePorDepto['Operaciones'],
        creada_en: addDays(today, -4)
      },
      {
        colaborador_id: colByEmail['jimena.torres@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, 25)),
        fecha_fin: formatDate(addDays(today, 29)),
        estado: 'pendiente',
        aprobador_id: jefePorDepto['Ventas'],
        creada_en: addDays(today, -10)
      },
      {
        colaborador_id: colByEmail['cindy.quiros@novacore.cr'].id,
        tipo: 'permiso_con_goce',
        fecha_inicio: formatDate(addDays(today, 12)),
        fecha_fin: formatDate(addDays(today, 14)),
        estado: 'pendiente',
        aprobador_id: jefePorDepto['Finanzas'],
        creada_en: addDays(today, -7)
      },
      {
        colaborador_id: colByEmail['pablo.cespedes@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, 16)),
        fecha_fin: formatDate(addDays(today, 19)),
        estado: 'pendiente',
        aprobador_id: jefePorDepto['Talento Humano'],
        creada_en: addDays(today, -5)
      },

      // Pendiente reciente (< 3 días)
      {
        colaborador_id: colByEmail['andres.salazar@novacore.cr'].id,
        tipo: 'teletrabajo',
        fecha_inicio: formatDate(addDays(today, 3)),
        fecha_fin: formatDate(addDays(today, 5)),
        estado: 'pendiente',
        aprobador_id: jefePorDepto['Ingeniería'],
        creada_en: addDays(today, -1)
      },

      // Historial últimos 3 meses (aprobadas y rechazadas pasadas)
      {
        colaborador_id: colByEmail['carlos.solano@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, -50)),
        fecha_fin: formatDate(addDays(today, -47)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Ingeniería'],
        creada_en: addDays(today, -65)
      },
      {
        colaborador_id: colByEmail['lucia.monge@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, -40)),
        fecha_fin: formatDate(addDays(today, -36)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Ingeniería'],
        creada_en: addDays(today, -55)
      },
      {
        colaborador_id: colByEmail['gabriel.zamora@novacore.cr'].id,
        tipo: 'teletrabajo',
        fecha_inicio: formatDate(addDays(today, -30)),
        fecha_fin: formatDate(addDays(today, -28)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Ingeniería'],
        creada_en: addDays(today, -35)
      },
      {
        colaborador_id: colByEmail['paula.quiros@novacore.cr'].id,
        tipo: 'permiso_con_goce',
        fecha_inicio: formatDate(addDays(today, -22)),
        fecha_fin: formatDate(addDays(today, -20)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Ingeniería'],
        creada_en: addDays(today, -34)
      },
      {
        colaborador_id: colByEmail['ignacio.quesada@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, -62)),
        fecha_fin: formatDate(addDays(today, -58)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Producto'],
        creada_en: addDays(today, -78)
      },
      {
        colaborador_id: colByEmail['adriana.salas@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, -15)),
        fecha_fin: formatDate(addDays(today, -12)),
        estado: 'rechazada',
        aprobador_id: jefePorDepto['Producto'],
        creada_en: addDays(today, -19)
      },
      {
        colaborador_id: colByEmail['oscar.fonseca@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, -70)),
        fecha_fin: formatDate(addDays(today, -66)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Operaciones'],
        creada_en: addDays(today, -85)
      },
      {
        colaborador_id: colByEmail['silvia.madrigal@novacore.cr'].id,
        tipo: 'permiso_sin_goce',
        fecha_inicio: formatDate(addDays(today, -45)),
        fecha_fin: formatDate(addDays(today, -31)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Operaciones'],
        creada_en: addDays(today, -68)
      },
      {
        colaborador_id: colByEmail['christian.bermudez@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, -26)),
        fecha_fin: formatDate(addDays(today, -22)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Ventas'],
        creada_en: addDays(today, -42)
      },
      {
        colaborador_id: colByEmail['randall.aguilar@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, -10)),
        fecha_fin: formatDate(addDays(today, -8)),
        estado: 'rechazada',
        aprobador_id: jefePorDepto['Ventas'],
        creada_en: addDays(today, -13)
      },
      {
        colaborador_id: colByEmail['gustavo.paniagua@novacore.cr'].id,
        tipo: 'vacaciones',
        fecha_inicio: formatDate(addDays(today, -33)),
        fecha_fin: formatDate(addDays(today, -29)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Finanzas'],
        creada_en: addDays(today, -48)
      },
      {
        colaborador_id: colByEmail['diana.urena@novacore.cr'].id,
        tipo: 'teletrabajo',
        fecha_inicio: formatDate(addDays(today, -14)),
        fecha_fin: formatDate(addDays(today, -12)),
        estado: 'aprobada',
        aprobador_id: jefePorDepto['Talento Humano'],
        creada_en: addDays(today, -20)
      }
    ];

    await queryInterface.bulkInsert('solicitudes', solicitudesData);

    // 4. incapacidades (últimos 3 meses, incluyendo al menos 3 activas HOY)
    const incapacidadesData = [
      // Activas HOY (4 registros)
      {
        colaborador_id: colByEmail['sebastian.conejo@novacore.cr'].id,
        tipo: 'enfermedad_comun',
        fecha_inicio: formatDate(addDays(today, -1)),
        dias: 4,
        entidad: 'CCSS'
      },
      {
        colaborador_id: colByEmail['grettel.arias@novacore.cr'].id,
        tipo: 'riesgo_trabajo',
        fecha_inicio: formatDate(addDays(today, -3)),
        dias: 10,
        entidad: 'INS'
      },
      {
        colaborador_id: colByEmail['priscila.zuniga@novacore.cr'].id,
        tipo: 'maternidad',
        fecha_inicio: formatDate(addDays(today, -35)),
        dias: 120,
        entidad: 'CCSS'
      },
      {
        colaborador_id: colByEmail['yendry.solorzano@novacore.cr'].id,
        tipo: 'enfermedad_comun',
        fecha_inicio: formatDate(today),
        dias: 3,
        entidad: 'CCSS'
      },

      // Históricas cerradas en los últimos 3 meses
      {
        colaborador_id: colByEmail['felipe.chacon@novacore.cr'].id,
        tipo: 'enfermedad_comun',
        fecha_inicio: formatDate(addDays(today, -75)),
        dias: 3,
        entidad: 'CCSS'
      },
      {
        colaborador_id: colByEmail['mariana.elizondo@novacore.cr'].id,
        tipo: 'enfermedad_comun',
        fecha_inicio: formatDate(addDays(today, -64)),
        dias: 5,
        entidad: 'CCSS'
      },
      {
        colaborador_id: colByEmail['karla.obando@novacore.cr'].id,
        tipo: 'riesgo_trabajo',
        fecha_inicio: formatDate(addDays(today, -58)),
        dias: 7,
        entidad: 'INS'
      },
      {
        colaborador_id: colByEmail['melissa.cruz@novacore.cr'].id,
        tipo: 'enfermedad_comun',
        fecha_inicio: formatDate(addDays(today, -49)),
        dias: 2,
        entidad: 'CCSS'
      },
      {
        colaborador_id: colByEmail['carlos.solano@novacore.cr'].id,
        tipo: 'enfermedad_comun',
        fecha_inicio: formatDate(addDays(today, -41)),
        dias: 2,
        entidad: 'CCSS'
      },
      {
        colaborador_id: colByEmail['roberto.jimenez@novacore.cr'].id,
        tipo: 'riesgo_trabajo',
        fecha_inicio: formatDate(addDays(today, -34)),
        dias: 6,
        entidad: 'INS'
      },
      {
        colaborador_id: colByEmail['jimena.torres@novacore.cr'].id,
        tipo: 'enfermedad_comun',
        fecha_inicio: formatDate(addDays(today, -27)),
        dias: 4,
        entidad: 'CCSS'
      },
      {
        colaborador_id: colByEmail['gustavo.paniagua@novacore.cr'].id,
        tipo: 'enfermedad_comun',
        fecha_inicio: formatDate(addDays(today, -19)),
        dias: 3,
        entidad: 'CCSS'
      },
      {
        colaborador_id: colByEmail['fiorella.camacho@novacore.cr'].id,
        tipo: 'enfermedad_comun',
        fecha_inicio: formatDate(addDays(today, -14)),
        dias: 2,
        entidad: 'CCSS'
      }
    ];

    await queryInterface.bulkInsert('incapacidades', incapacidadesData);

    // 5. movimientos_personal (ingresos, salidas y ascensos en últimos 3 meses)
    const movimientosData = [
      {
        colaborador_id: colByEmail['mauricio.leon@novacore.cr'].id,
        tipo: 'ingreso',
        fecha: formatDate(addDays(today, -60)),
        motivo: 'Contratación nueva plaza Product Analyst'
      },
      {
        colaborador_id: colByEmail['natalia.guzman@novacore.cr'].id,
        tipo: 'ingreso',
        fecha: formatDate(addDays(today, -45)),
        motivo: 'Contratación Desarrolladora Frontend React'
      },
      {
        colaborador_id: colByEmail['brayan.vindas@novacore.cr'].id,
        tipo: 'ingreso',
        fecha: formatDate(addDays(today, -35)),
        motivo: 'Contratación Especialista Service Desk'
      },
      {
        colaborador_id: colByEmail['rebeca.alvarado@novacore.cr'].id,
        tipo: 'ingreso',
        fecha: formatDate(addDays(today, -25)),
        motivo: 'Contratación Desarrolladora Junior'
      },
      {
        colaborador_id: colByEmail['pamela.cortes@novacore.cr'].id,
        tipo: 'ingreso',
        fecha: formatDate(addDays(today, -18)),
        motivo: 'Contratación Sales Development Representative'
      },
      {
        colaborador_id: colByEmail['tomas.hidalgo@novacore.cr'].id,
        tipo: 'salida',
        fecha: formatDate(addDays(today, -52)),
        motivo: 'Renuncia voluntaria por oportunidad en el extranjero'
      },
      {
        colaborador_id: colByEmail['hector.murillo@novacore.cr'].id,
        tipo: 'salida',
        fecha: formatDate(addDays(today, -28)),
        motivo: 'Despido con responsabilidad patronal por reestructuración'
      },
      {
        colaborador_id: colByEmail['marco.mendez@novacore.cr'].id,
        tipo: 'salida',
        fecha: formatDate(addDays(today, -11)),
        motivo: 'Renuncia voluntaria con preaviso cumplido'
      },
      {
        colaborador_id: colByEmail['carlos.solano@novacore.cr'].id,
        tipo: 'ascenso',
        fecha: formatDate(addDays(today, -40)),
        motivo: 'Promoción semestral a Desarrollador Full-Stack Senior'
      },
      {
        colaborador_id: colByEmail['elena.rodriguez@novacore.cr'].id,
        tipo: 'ascenso',
        fecha: formatDate(addDays(today, -32)),
        motivo: 'Promoción a Product Manager Senior'
      },
      {
        colaborador_id: colByEmail['carolina.pacheco@novacore.cr'].id,
        tipo: 'ascenso',
        fecha: formatDate(addDays(today, -15)),
        motivo: 'Promoción a Especialista Senior de RRHH'
      }
    ];

    await queryInterface.bulkInsert('movimientos_personal', movimientosData);

    // 6. consultas_chat (34 consultas simuladas: 31 resueltas citando los 10 docs + 3 escaladas/no resueltas)
    const consultasBase = [
      { email: 'carlos.solano@novacore.cr', pregunta: '¿Cuántos días de vacaciones me corresponden al año y cuál es el tope de acumulación?', intencion: 'consulta_politica', agente: 'AgentePoliticasLaborales', docs: ['01_politica_vacaciones_feriados.md'], resuelta: true, escalada: false, latencia: 840, diasAtras: 14 },
      { email: 'carlos.solano@novacore.cr', pregunta: '¿Cuántos días de vacaciones disponibles tengo actualmente?', intencion: 'consulta_datos_personales', agente: 'AgenteDatosColaborador', docs: ['01_politica_vacaciones_feriados.md'], resuelta: true, escalada: false, latencia: 420, diasAtras: 13 },
      { email: 'daniela.araya@novacore.cr', pregunta: '¿Cuáles son los feriados oficiales de Costa Rica en el último trimestre del año?', intencion: 'consulta_politica', agente: 'AgentePoliticasLaborales', docs: ['01_politica_vacaciones_feriados.md'], resuelta: true, escalada: false, latencia: 910, diasAtras: 12 },
      { email: 'mateo.herrera@novacore.cr', pregunta: '¿Con cuántos días de anticipación debo pedir mis vacaciones?', intencion: 'consulta_politica', agente: 'AgentePoliticasLaborales', docs: ['01_politica_vacaciones_feriados.md'], resuelta: true, escalada: false, latencia: 760, diasAtras: 12 },
      { email: 'camila.valverde@novacore.cr', pregunta: '¿Cuántos días libres me dan por matrimonio?', intencion: 'consulta_politica', agente: 'AgentePermisosLicencias', docs: ['02_politica_permisos_licencias.md'], resuelta: true, escalada: false, latencia: 690, diasAtras: 11 },
      { email: 'andres.salazar@novacore.cr', pregunta: '¿Cómo funciona la licencia de paternidad en Costa Rica según la política?', intencion: 'consulta_politica', agente: 'AgentePermisosLicencias', docs: ['02_politica_permisos_licencias.md'], resuelta: true, escalada: false, latencia: 880, diasAtras: 11 },
      { email: 'lucia.monge@novacore.cr', pregunta: '¿Cuántos días corresponden por fallecimiento de un familiar de primer grado?', intencion: 'consulta_politica', agente: 'AgentePermisosLicencias', docs: ['02_politica_permisos_licencias.md'], resuelta: true, escalada: false, latencia: 710, diasAtras: 10 },
      { email: 'gabriel.zamora@novacore.cr', pregunta: '¿Qué porcentaje del salario me pagan si me incapacito 2 días por enfermedad común?', intencion: 'consulta_politica', agente: 'AgenteIncapacidadesSalud', docs: ['03_procedimiento_incapacidades.md'], resuelta: true, escalada: false, latencia: 950, diasAtras: 10 },
      { email: 'paula.quiros@novacore.cr', pregunta: '¿Cuál es el plazo máximo para entregar la boleta de incapacidad a Talento Humano?', intencion: 'consulta_politica', agente: 'AgenteIncapacidadesSalud', docs: ['03_procedimiento_incapacidades.md'], resuelta: true, escalada: false, latencia: 640, diasAtras: 9 },
      { email: 'sebastian.conejo@novacore.cr', pregunta: '¿Qué pasa después del día 4 de una incapacidad médica por CCSS?', intencion: 'consulta_politica', agente: 'AgenteIncapacidadesSalud', docs: ['03_procedimiento_incapacidades.md'], resuelta: true, escalada: false, latencia: 890, diasAtras: 9 },
      { email: 'elena.rodriguez@novacore.cr', pregunta: '¿Cuántos días por semana puedo hacer teletrabajo bajo modalidad híbrida?', intencion: 'consulta_politica', agente: 'AgenteJornadaTeletrabajo', docs: ['04_reglamento_jornada_teletrabajo.md'], resuelta: true, escalada: false, latencia: 620, diasAtras: 8 },
      { email: 'julian.ramirez@novacore.cr', pregunta: '¿Cómo se pagan las horas extra en jornada ordinaria y en feriado obligatorio?', intencion: 'consulta_politica', agente: 'AgenteJornadaTeletrabajo', docs: ['04_reglamento_jornada_teletrabajo.md'], resuelta: true, escalada: false, latencia: 980, diasAtras: 8 },
      { email: 'monica.navarro@novacore.cr', pregunta: '¿Cuál es la duración máxima de la jornada diurna, mixta y nocturna?', intencion: 'consulta_politica', agente: 'AgenteJornadaTeletrabajo', docs: ['04_reglamento_jornada_teletrabajo.md'], resuelta: true, escalada: false, latencia: 810, diasAtras: 7 },
      { email: 'ignacio.quesada@novacore.cr', pregunta: '¿Qué días del mes depositan la planilla quincenal?', intencion: 'consulta_politica', agente: 'AgenteCompensacionBeneficios', docs: ['05_politica_salarial_pagos.md'], resuelta: true, escalada: false, latencia: 650, diasAtras: 7 },
      { email: 'adriana.salas@novacore.cr', pregunta: '¿Cuándo pagan el aguinaldo y cuál es la fórmula exacta para calcularlo?', intencion: 'consulta_politica', agente: 'AgenteCompensacionBeneficios', docs: ['05_politica_salarial_pagos.md'], resuelta: true, escalada: false, latencia: 1020, diasAtras: 6 },
      { email: 'roberto.jimenez@novacore.cr', pregunta: '¿Qué deducciones legales se aplican al salario bruto en cada quincena?', intencion: 'consulta_politica', agente: 'AgenteCompensacionBeneficios', docs: ['05_politica_salarial_pagos.md'], resuelta: true, escalada: false, latencia: 870, diasAtras: 6 },
      { email: 'tatiana.gomez@novacore.cr', pregunta: '¿Qué porcentajes cubre el seguro médico privado colectivo en consulta externa y hospitalización?', intencion: 'consulta_politica', agente: 'AgenteCompensacionBeneficios', docs: ['06_catalogo_beneficios.md'], resuelta: true, escalada: false, latencia: 920, diasAtras: 6 },
      { email: 'oscar.fonseca@novacore.cr', pregunta: '¿Cómo funciona el aporte patronal y ahorro obrero en la Asociación Solidarista?', intencion: 'consulta_politica', agente: 'AgenteCompensacionBeneficios', docs: ['06_catalogo_beneficios.md'], resuelta: true, escalada: false, latencia: 850, diasAtras: 5 },
      { email: 'silvia.madrigal@novacore.cr', pregunta: '¿Cuánto es el bono anual de capacitación y qué rubros cubre?', intencion: 'consulta_politica', agente: 'AgenteCompensacionBeneficios', docs: ['06_catalogo_beneficios.md'], resuelta: true, escalada: false, latencia: 790, diasAtras: 5 },
      { email: 'fabiola.piedra@novacore.cr', pregunta: '¿Cuánto dura el periodo de prueba en NovaCore?', intencion: 'consulta_politica', agente: 'AgentePoliticasLaborales', docs: ['07_manual_onboarding_salida.md'], resuelta: true, escalada: false, latencia: 670, diasAtras: 5 },
      { email: 'christian.bermudez@novacore.cr', pregunta: 'Si renuncio después de 8 meses, ¿cuántos días de preaviso debo dar?', intencion: 'consulta_politica', agente: 'AgentePoliticasLaborales', docs: ['07_manual_onboarding_salida.md'], resuelta: true, escalada: false, latencia: 830, diasAtras: 4 },
      { email: 'priscila.zuniga@novacore.cr', pregunta: '¿Qué rubros incluye la liquidación por despido sin justa causa y cuál es el tope de cesantía?', intencion: 'consulta_politica', agente: 'AgentePoliticasLaborales', docs: ['07_manual_onboarding_salida.md'], resuelta: true, escalada: false, latencia: 1090, diasAtras: 4 },
      { email: 'irene.viquez@novacore.cr', pregunta: '¿En qué meses se realiza la evaluación de desempeño semestral?', intencion: 'consulta_politica', agente: 'AgenteTalentoCultura', docs: ['08_politica_evaluacion_desempeno.md'], resuelta: true, escalada: false, latencia: 720, diasAtras: 4 },
      { email: 'gustavo.paniagua@novacore.cr', pregunta: '¿Qué requisitos debo cumplir para postularme a una promoción interna?', intencion: 'consulta_politica', agente: 'AgenteTalentoCultura', docs: ['08_politica_evaluacion_desempeno.md'], resuelta: true, escalada: false, latencia: 780, diasAtras: 3 },
      { email: 'cindy.quiros@novacore.cr', pregunta: '¿Cómo funciona un Plan de Mejora del Desempeño (PIP)?', intencion: 'consulta_politica', agente: 'AgenteTalentoCultura', docs: ['08_politica_evaluacion_desempeno.md'], resuelta: true, escalada: false, latencia: 860, diasAtras: 3 },
      { email: 'arturo.brenes@novacore.cr', pregunta: '¿Cuál es el canal confidencial para denunciar acoso laboral u hostigamiento sexual?', intencion: 'consulta_politica', agente: 'AgenteCumplimientoEtica', docs: ['09_codigo_conducta_denuncias.md'], resuelta: true, escalada: false, latencia: 740, diasAtras: 3 },
      { email: 'diana.urena@novacore.cr', pregunta: '¿Qué garantías de no represalia existen para quienes denuncian en el buzón anónimo?', intencion: 'consulta_politica', agente: 'AgenteCumplimientoEtica', docs: ['09_codigo_conducta_denuncias.md'], resuelta: true, escalada: false, latencia: 800, diasAtras: 2 },
      { email: 'pablo.cespedes@novacore.cr', pregunta: '¿Cómo puedo ejercer mis derechos ARCO sobre mi expediente laboral?', intencion: 'consulta_politica', agente: 'AgenteCumplimientoEtica', docs: ['10_aviso_privacidad_colaboradores.md'], resuelta: true, escalada: false, latencia: 770, diasAtras: 2 },
      { email: 'fiorella.camacho@novacore.cr', pregunta: '¿Quién tiene acceso a mis datos salariales e incapacidades según la Ley 8968?', intencion: 'consulta_politica', agente: 'AgenteCumplimientoEtica', docs: ['10_aviso_privacidad_colaboradores.md'], resuelta: true, escalada: false, latencia: 850, diasAtras: 2 },
      { email: 'laura.mendez@novacore.cr', pregunta: '¿Cuál fue el estado de mis últimas solicitudes registradas en el portal?', intencion: 'consulta_datos_personales', agente: 'AgenteDatosColaborador', docs: ['01_politica_vacaciones_feriados.md'], resuelta: true, escalada: false, latencia: 390, diasAtras: 1 },
      { email: 'carolina.pacheco@novacore.cr', pregunta: '¿Qué documentos regulan la licencia por maternidad y lactancia?', intencion: 'consulta_politica', agente: 'AgentePermisosLicencias', docs: ['02_politica_permisos_licencias.md'], resuelta: true, escalada: false, latencia: 710, diasAtras: 1 },

      // 3 consultas NO resueltas / escaladas a RRHH
      { email: 'randall.aguilar@novacore.cr', pregunta: '¿Cuánto es el monto del bono por mascotas que ofrece NovaCore?', intencion: 'consulta_politica', agente: 'AgenteCompensacionBeneficios', docs: ['06_catalogo_beneficios.md'], resuelta: false, escalada: true, latencia: 1150, diasAtras: 5 },
      { email: 'kevin.morales@novacore.cr', pregunta: 'Necesito una excepción especial para hacer teletrabajo desde el extranjero por 4 meses por motivos familiares.', intencion: 'caso_excepcional_rrhh', agente: 'AgenteJornadaTeletrabajo', docs: ['04_reglamento_jornada_teletrabajo.md', '02_politica_permisos_licencias.md'], resuelta: false, escalada: true, latencia: 1340, diasAtras: 3 },
      { email: 'mariana.elizondo@novacore.cr', pregunta: 'Deseo solicitar una reunión urgente con Comité de Ética para ampliar una denuncia confidencial.', intencion: 'escalamiento_etica', agente: 'AgenteCumplimientoEtica', docs: ['09_codigo_conducta_denuncias.md'], resuelta: false, escalada: true, latencia: 980, diasAtras: 1 }
    ];

    const consultasData = consultasBase.map((item, idx) => {
      const fechaConsulta = addDays(today, -item.diasAtras);
      fechaConsulta.setHours(9 + (idx % 8), (idx * 7) % 60, 0, 0);
      return {
        colaborador_id: colByEmail[item.email].id,
        pregunta: item.pregunta,
        intencion: item.intencion,
        agente: item.agente,
        documentos_citados: JSON.stringify(item.docs),
        resuelta: item.resuelta,
        escalada: item.escalada,
        latencia_ms: item.latencia,
        fecha: fechaConsulta
      };
    });

    await queryInterface.bulkInsert('consultas_chat', consultasData);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('consultas_chat', null, {});
    await queryInterface.bulkDelete('movimientos_personal', null, {});
    await queryInterface.bulkDelete('incapacidades', null, {});
    await queryInterface.bulkDelete('solicitudes', null, {});
    await queryInterface.bulkDelete('saldos_vacaciones', null, {});
    await queryInterface.bulkDelete('colaboradores', null, {});
  }
};

