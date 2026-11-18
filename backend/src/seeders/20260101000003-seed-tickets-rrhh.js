'use strict';

const { Colaborador, TicketRRHH } = require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up() {
    const existing = await TicketRRHH.count();
    if (existing > 0) {
      console.log('Seeder de tickets_rrhh ya ejecutado previamente. Omitiendo.');
      return;
    }

    const carlos = await Colaborador.findOne({ where: { email: 'carlos.solano@novacore.cr' } });
    const randall = await Colaborador.findOne({ where: { email: 'randall.aguilar@novacore.cr' } });
    const kevin = await Colaborador.findOne({ where: { email: 'kevin.morales@novacore.cr' } });
    const laura = await Colaborador.findOne({ where: { email: 'laura.mendez@novacore.cr' } });

    if (!carlos || !randall || !kevin || !laura) {
      return;
    }

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    await TicketRRHH.bulkCreate([
      {
        codigo: 'TKT-2026-001',
        colaborador_id: randall.id,
        consulta_original: '¿La empresa da bono por mascotas?',
        motivo: 'Consulta escalada sin política vigente en Google Drive',
        estado: 'abierto',
        respuesta_rrhh: null,
        atendido_por: null,
        resuelto_en: null,
        created_at: fiveDaysAgo,
        updated_at: fiveDaysAgo
      },
      {
        codigo: 'TKT-2026-002',
        colaborador_id: kevin.id,
        consulta_original:
          'Necesito una excepción especial para hacer teletrabajo desde el extranjero por 4 meses por motivos familiares.',
        motivo: 'Solicitud de excepción internacional de teletrabajo (requiere evaluación de Talento Humano)',
        estado: 'abierto',
        respuesta_rrhh: null,
        atendido_por: null,
        resuelto_en: null,
        created_at: twoDaysAgo,
        updated_at: twoDaysAgo
      },
      {
        codigo: 'TKT-2026-003',
        colaborador_id: carlos.id,
        consulta_original: '¿La empresa ofrece subsidio para compra de vehículo eléctrico?',
        motivo: 'Consulta escalada sobre beneficio no catalogado',
        estado: 'resuelto',
        respuesta_rrhh:
          'Hola Carlos. Actualmente NovaCore Technologies CR no cuenta con un programa de subsidio para compra de vehículos eléctricos; nuestros beneficios vigentes se detallan en el Catálogo Oficial de Beneficios (CAT-RRHH-06).',
        atendido_por: laura.id,
        resuelto_en: twoDaysAgo,
        created_at: fiveDaysAgo,
        updated_at: twoDaysAgo
      }
    ]);
  },

  async down() {
    await TicketRRHH.destroy({ where: {} });
  }
};

