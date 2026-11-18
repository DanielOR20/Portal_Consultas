'use strict';

const { z } = require('zod');
const { TicketRRHH, Colaborador } = require('../models');
const { createEscalationTicket } = require('../agents/escalamientoAgent');

const createTicketSchema = z.object({
  consulta_original: z
    .string({ required_error: 'La consulta original es obligatoria.' })
    .trim()
    .min(3, 'La consulta original es demasiado corta.')
    .max(2000),
  motivo: z
    .string()
    .trim()
    .max(255)
    .optional()
    .default('Consulta escalada sin política vigente en Google Drive')
});

const resolveTicketSchema = z.object({
  respuesta_rrhh: z
    .string({ required_error: 'La respuesta oficial de RRHH es obligatoria.' })
    .trim()
    .min(5, 'La respuesta debe tener al menos 5 caracteres.')
    .max(4000),
  estado: z.enum(['en_revision', 'resuelto']).optional().default('resuelto')
});

async function createTicket(req, res, next) {
  try {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Datos de ticket inválidos.'
      });
    }

    const ticket = await createEscalationTicket({
      colaboradorId: req.user.id,
      consultaOriginal: parsed.data.consulta_original,
      motivo: parsed.data.motivo
    });

    return res.status(201).json({
      ok: true,
      ticket
    });
  } catch (err) {
    return next(err);
  }
}

async function getMyTickets(req, res, next) {
  try {
    const tickets = await TicketRRHH.findAll({
      where: { colaborador_id: req.user.id },
      include: [
        {
          model: Colaborador,
          as: 'atendedor',
          attributes: ['id', 'nombre', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      ok: true,
      total: tickets.length,
      tickets
    });
  } catch (err) {
    return next(err);
  }
}

async function getAllTickets(req, res, next) {
  try {
    const tickets = await TicketRRHH.findAll({
      include: [
        {
          model: Colaborador,
          as: 'colaborador',
          attributes: ['id', 'nombre', 'email', 'departamento', 'puesto']
        },
        {
          model: Colaborador,
          as: 'atendedor',
          attributes: ['id', 'nombre', 'email']
        }
      ],
      order: [
        ['estado', 'ASC'],
        ['created_at', 'DESC']
      ]
    });

    return res.status(200).json({
      ok: true,
      total: tickets.length,
      tickets
    });
  } catch (err) {
    return next(err);
  }
}

async function resolveTicket(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'ID de ticket inválido.'
      });
    }

    const parsed = resolveTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Respuesta de resolución inválida.'
      });
    }

    const ticket = await TicketRRHH.findByPk(ticketId);
    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: 'Ticket no encontrado.'
      });
    }

    const nextEstado = parsed.data.estado || 'resuelto';
    await ticket.update({
      respuesta_rrhh: parsed.data.respuesta_rrhh,
      estado: nextEstado,
      atendido_por: req.user.id,
      resuelto_en: nextEstado === 'resuelto' ? new Date() : null
    });

    const updated = await TicketRRHH.findByPk(ticket.id, {
      include: [
        {
          model: Colaborador,
          as: 'colaborador',
          attributes: ['id', 'nombre', 'email', 'departamento', 'puesto']
        },
        {
          model: Colaborador,
          as: 'atendedor',
          attributes: ['id', 'nombre', 'email']
        }
      ]
    });

    return res.status(200).json({
      ok: true,
      ticket: updated
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createTicket,
  getMyTickets,
  getAllTickets,
  resolveTicket
};

