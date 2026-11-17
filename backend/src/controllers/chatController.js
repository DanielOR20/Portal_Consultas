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

module.exports = {
  postChat,
  getChatHistory
};

