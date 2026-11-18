'use strict';

const { TicketRRHH, Colaborador } = require('../models');

async function generateCorrelativeCode() {
  const year = new Date().getFullYear();
  const [totalCount, lastTicket] = await Promise.all([
    TicketRRHH.count(),
    TicketRRHH.findOne({
      attributes: ['id', 'codigo'],
      order: [['id', 'DESC']],
      raw: true
    })
  ]);

  let lastSeq = 0;
  if (lastTicket && lastTicket.codigo) {
    const match = String(lastTicket.codigo).match(/(\d+)$/);
    if (match) {
      lastSeq = Number(match[1]) || 0;
    }
  }

  const nextSeq = Math.max(totalCount, lastSeq) + 1;
  return `TKT-${year}-${String(nextSeq).padStart(3, '0')}`;
}

async function createEscalationTicket({ colaboradorId, consultaOriginal, motivo }) {
  const codigo = await generateCorrelativeCode();

  const created = await TicketRRHH.create({
    codigo,
    colaborador_id: colaboradorId,
    consulta_original: String(consultaOriginal || '').trim(),
    motivo: String(motivo || 'Consulta escalada sin política vigente en Google Drive').slice(0, 255),
    estado: 'abierto',
    respuesta_rrhh: null,
    atendido_por: null,
    resuelto_en: null
  });

  const ticket = await TicketRRHH.findByPk(created.id, {
    include: [
      {
        model: Colaborador,
        as: 'colaborador',
        attributes: ['id', 'nombre', 'email', 'departamento', 'puesto']
      }
    ]
  });

  return ticket;
}

module.exports = {
  createEscalationTicket,
  generateCorrelativeCode
};

