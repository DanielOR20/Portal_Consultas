'use strict';

const { z } = require('zod');
const { ConsultaChat } = require('../models');
const { runOrquestadorAgent } = require('../agents/orquestadorAgent');

const chatSchema = z.object({
  pregunta: z
    .string({ required_error: 'La pregunta es obligatoria.' })
    .trim()
    .min(2, 'La pregunta debe tener al menos 2 caracteres.')
    .max(2000, 'La pregunta supera la longitud máxima permitida.'),
  historial: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string()
      })
    )
    .optional()
    .default([])
});

const feedbackSchema = z.object({
  util: z.boolean({ required_error: 'El campo booleano util es obligatorio.' })
});

async function postChat(req, res, next) {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Solicitud de chat inválida.'
      });
    }

    const { pregunta, historial } = parsed.data;
    const result = await runOrquestadorAgent(pregunta, req.user, historial);

    return res.status(200).json({
      ok: true,
      ...result
    });
  } catch (err) {
    return next(err);
  }
}

async function getChatHistory(req, res, next) {
  try {
    const consultas = await ConsultaChat.findAll({
      where: { colaborador_id: req.user.id },
      order: [['fecha', 'DESC']],
      limit: 20
    });

    return res.status(200).json({
      ok: true,
      total: consultas.length,
      historial: consultas
    });
  } catch (err) {
    return next(err);
  }
}

async function submitFeedback(req, res, next) {
  try {
    const consultaId = Number(req.params.id);
    if (!Number.isInteger(consultaId) || consultaId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'ID de consulta inválido.'
      });
    }

    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Valoración inválida.'
      });
    }

    const consulta = await ConsultaChat.findOne({
      where: {
        id: consultaId,
        colaborador_id: req.user.id
      }
    });

    if (!consulta) {
      return res.status(404).json({
        ok: false,
        error: 'Consulta de chat no encontrada.'
      });
    }

    await ConsultaChat.update(
      { util: parsed.data.util },
      { where: { id: consultaId, colaborador_id: req.user.id } }
    );

    return res.status(200).json({
      ok: true,
      consultaId,
      util: parsed.data.util
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  postChat,
  getChatHistory,
  submitFeedback
};
