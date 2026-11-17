'use strict';

const { PalabraClave } = require('../models');

const KEYWORDS_DATA = [
  // 1. restringida (11 palabras - Guardrails privacidad Ley N.° 8968)
  { palabra: 'salario', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'sueldo', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'gana', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'remuneración de', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'compañero', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'compañera', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'gerente', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'jefe', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'expediente de', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'vacaciones de', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'evaluación de', categoria: 'restringida', tema_asociado: 'Privacidad y Seguridad' },

  // 2. fuera_alcance (9 palabras)
  { palabra: 'película', categoria: 'fuera_alcance', tema_asociado: null },
  { palabra: 'receta', categoria: 'fuera_alcance', tema_asociado: null },
  { palabra: 'fútbol', categoria: 'fuera_alcance', tema_asociado: null },
  { palabra: 'partido', categoria: 'fuera_alcance', tema_asociado: null },
  { palabra: 'chiste', categoria: 'fuera_alcance', tema_asociado: null },
  { palabra: 'clima', categoria: 'fuera_alcance', tema_asociado: null },
  { palabra: 'programar', categoria: 'fuera_alcance', tema_asociado: null },
  { palabra: 'código python', categoria: 'fuera_alcance', tema_asociado: null },
  { palabra: 'música', categoria: 'fuera_alcance', tema_asociado: null },

  // 3. dato_personal (9 palabras)
  { palabra: 'me quedan', categoria: 'dato_personal', tema_asociado: 'Vacaciones y Feriados' },
  { palabra: 'mi saldo', categoria: 'dato_personal', tema_asociado: 'Vacaciones y Feriados' },
  { palabra: 'mis vacaciones', categoria: 'dato_personal', tema_asociado: 'Vacaciones y Feriados' },
  { palabra: 'mi próximo pago', categoria: 'dato_personal', tema_asociado: 'Salarios y Aguinaldo' },
  { palabra: 'mi solicitud', categoria: 'dato_personal', tema_asociado: 'Permisos y Licencias' },
  { palabra: 'mi evaluación', categoria: 'dato_personal', tema_asociado: 'Evaluación del Desempeño' },
  { palabra: 'mi próxima evaluación', categoria: 'dato_personal', tema_asociado: 'Evaluación del Desempeño' },
  { palabra: 'evaluación de desempeño', categoria: 'politica', tema_asociado: 'Evaluación del Desempeño' },
  { palabra: 'mis incapacidades', categoria: 'dato_personal', tema_asociado: 'Incapacidades' },
  { palabra: 'mi puesto', categoria: 'dato_personal', tema_asociado: 'Onboarding y Liquidación' },
  { palabra: 'mi fecha de ingreso', categoria: 'dato_personal', tema_asociado: 'Onboarding y Liquidación' },

  // 4. politica (20 palabras para enrutamiento y recuperación semántica)
  { palabra: 'vacaciones', categoria: 'politica', tema_asociado: 'Vacaciones y Feriados' },
  { palabra: 'feriados', categoria: 'politica', tema_asociado: 'Vacaciones y Feriados' },
  { palabra: 'aguinaldo', categoria: 'politica', tema_asociado: 'Salarios y Aguinaldo' },
  { palabra: 'planilla', categoria: 'politica', tema_asociado: 'Salarios y Aguinaldo' },
  { palabra: 'ccss', categoria: 'politica', tema_asociado: 'Incapacidades' },
  { palabra: 'incapacidad', categoria: 'politica', tema_asociado: 'Incapacidades' },
  { palabra: 'ins', categoria: 'politica', tema_asociado: 'Incapacidades' },
  { palabra: 'teletrabajo', categoria: 'politica', tema_asociado: 'Jornada y Teletrabajo' },
  { palabra: 'horas extra', categoria: 'politica', tema_asociado: 'Jornada y Teletrabajo' },
  { palabra: 'maternidad', categoria: 'politica', tema_asociado: 'Permisos y Licencias' },
  { palabra: 'paternidad', categoria: 'politica', tema_asociado: 'Permisos y Licencias' },
  { palabra: 'fallecimiento', categoria: 'politica', tema_asociado: 'Permisos y Licencias' },
  { palabra: 'matrimonio', categoria: 'politica', tema_asociado: 'Permisos y Licencias' },
  { palabra: 'preaviso', categoria: 'politica', tema_asociado: 'Onboarding y Liquidación' },
  { palabra: 'liquidación', categoria: 'politica', tema_asociado: 'Onboarding y Liquidación' },
  { palabra: 'periodo de prueba', categoria: 'politica', tema_asociado: 'Onboarding y Liquidación' },
  { palabra: 'seguro médico', categoria: 'politica', tema_asociado: 'Beneficios' },
  { palabra: 'asociación solidarista', categoria: 'politica', tema_asociado: 'Beneficios' },
  { palabra: 'acoso', categoria: 'politica', tema_asociado: 'Ética y Denuncias' },
  { palabra: 'derechos arco', categoria: 'politica', tema_asociado: 'Privacidad y Seguridad' },

  // 5. tema_dashboard (26 palabras para clasificación dinámica del Top 5 en analistaAgent)
  { palabra: 'vacaciones', categoria: 'tema_dashboard', tema_asociado: 'Vacaciones y Feriados' },
  { palabra: 'feriado', categoria: 'tema_dashboard', tema_asociado: 'Vacaciones y Feriados' },
  { palabra: 'acumular', categoria: 'tema_dashboard', tema_asociado: 'Vacaciones y Feriados' },
  { palabra: 'aguinaldo', categoria: 'tema_dashboard', tema_asociado: 'Salarios y Aguinaldo' },
  { palabra: 'planilla', categoria: 'tema_dashboard', tema_asociado: 'Salarios y Aguinaldo' },
  { palabra: 'pago', categoria: 'tema_dashboard', tema_asociado: 'Salarios y Aguinaldo' },
  { palabra: 'descuentan', categoria: 'tema_dashboard', tema_asociado: 'Salarios y Aguinaldo' },
  { palabra: 'incapacidad', categoria: 'tema_dashboard', tema_asociado: 'Incapacidades' },
  { palabra: 'incapacitaron', categoria: 'tema_dashboard', tema_asociado: 'Incapacidades' },
  { palabra: 'accidente laboral', categoria: 'tema_dashboard', tema_asociado: 'Incapacidades' },
  { palabra: 'teletrabajo', categoria: 'tema_dashboard', tema_asociado: 'Jornada y Teletrabajo' },
  { palabra: 'desde casa', categoria: 'tema_dashboard', tema_asociado: 'Jornada y Teletrabajo' },
  { palabra: 'horas extra', categoria: 'tema_dashboard', tema_asociado: 'Jornada y Teletrabajo' },
  { palabra: 'jornada', categoria: 'tema_dashboard', tema_asociado: 'Jornada y Teletrabajo' },
  { palabra: 'permiso', categoria: 'tema_dashboard', tema_asociado: 'Permisos y Licencias' },
  { palabra: 'fallecimiento', categoria: 'tema_dashboard', tema_asociado: 'Permisos y Licencias' },
  { palabra: 'maternidad', categoria: 'tema_dashboard', tema_asociado: 'Permisos y Licencias' },
  { palabra: 'paternidad', categoria: 'tema_dashboard', tema_asociado: 'Permisos y Licencias' },
  { palabra: 'preaviso', categoria: 'tema_dashboard', tema_asociado: 'Onboarding y Liquidación' },
  { palabra: 'liquidación', categoria: 'tema_dashboard', tema_asociado: 'Onboarding y Liquidación' },
  { palabra: 'periodo de prueba', categoria: 'tema_dashboard', tema_asociado: 'Onboarding y Liquidación' },
  { palabra: 'seguro médico', categoria: 'tema_dashboard', tema_asociado: 'Beneficios' },
  { palabra: 'solidarista', categoria: 'tema_dashboard', tema_asociado: 'Beneficios' },
  { palabra: 'capacitación', categoria: 'tema_dashboard', tema_asociado: 'Beneficios' },
  { palabra: 'acoso', categoria: 'tema_dashboard', tema_asociado: 'Ética y Denuncias' },
  { palabra: 'denuncia', categoria: 'tema_dashboard', tema_asociado: 'Ética y Denuncias' },
  { palabra: 'evaluación', categoria: 'tema_dashboard', tema_asociado: 'Evaluación del Desempeño' },
  { palabra: 'promoción', categoria: 'tema_dashboard', tema_asociado: 'Evaluación del Desempeño' },
  { palabra: 'arco', categoria: 'tema_dashboard', tema_asociado: 'Privacidad y Seguridad' },
  { palabra: 'privacidad', categoria: 'tema_dashboard', tema_asociado: 'Privacidad y Seguridad' }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up() {
    const existingRows = await PalabraClave.findAll({
      attributes: ['palabra', 'categoria'],
      raw: true
    });
    const existingKeys = new Set(
      existingRows.map((r) => `${r.palabra.toLowerCase()}::${r.categoria}`)
    );

    const toInsert = KEYWORDS_DATA.filter(
      (k) => !existingKeys.has(`${k.palabra.toLowerCase()}::${k.categoria}`)
    ).map((k) => ({
      palabra: k.palabra.toLowerCase(),
      categoria: k.categoria,
      tema_asociado: k.tema_asociado,
      activa: true
    }));

    if (toInsert.length > 0) {
      await PalabraClave.bulkCreate(toInsert);
    }
  },

  async down() {
    await PalabraClave.destroy({ where: {} });
  }
};

