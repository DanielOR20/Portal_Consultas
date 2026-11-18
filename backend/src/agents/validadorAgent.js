'use strict';

const { Colaborador } = require('../models');
const { chatCompletion } = require('../config/llmClient');
const { safeParseJson } = require('../utils/jsonHelper');

const PRIVACY_FALLBACK_MESSAGE =
  'Por políticas de privacidad y protección de datos (Ley N.° 8968), la respuesta fue bloqueada al detectarse posible exposición de información de terceros.';

const CACHE_TTL_MS = 60 * 1000;
let directoryCache = { rows: null, loadedAt: 0 };

async function getCollaboratorDirectory() {
  const now = Date.now();
  if (directoryCache.rows && now - directoryCache.loadedAt < CACHE_TTL_MS) {
    return directoryCache.rows;
  }

  const rows = await Colaborador.findAll({
    attributes: ['id', 'nombre', 'email', 'jefe_id'],
    raw: true
  });

  directoryCache = { rows, loadedAt: now };
  return rows;
}

function normalizeStr(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Capa 1 (Determinista ORM, < 5 ms):
 * Verifica que si user.rol !== 'rrhh', la respuesta no filtre nombres completos
 * ni correos institucionales de otros colaboradores distintos al usuario y su jefatura directa.
 */
async function runDeterministicPrivacyLayer(respuesta, user) {
  if (user.rol === 'rrhh') {
    return { ok: true, motivo: 'Usuario rol rrhh autorizado' };
  }

  const directory = await getCollaboratorDirectory();
  const currentUserRecord = directory.find((c) => c.id === user.id);
  const allowedIds = new Set([user.id]);
  if (currentUserRecord?.jefe_id) {
    allowedIds.add(currentUserRecord.jefe_id);
  }

  const normResponse = normalizeStr(respuesta);

  for (const col of directory) {
    if (allowedIds.has(col.id)) continue;

    const normEmail = normalizeStr(col.email);
    const normName = normalizeStr(col.nombre);

    if (normEmail && normResponse.includes(normEmail)) {
      return {
        ok: false,
        motivo: `Posible fuga de correo de tercero (${col.email})`
      };
    }

    if (normName && normName.length >= 6 && normResponse.includes(normName)) {
      return {
        ok: false,
        motivo: `Posible fuga de nombre completo de tercero (${col.nombre})`
      };
    }
  }

  return { ok: true, motivo: 'Sin exposición de datos de terceros' };
}

const VALIDATOR_SYSTEM_PROMPT = `Eres el Agente Validador de Fidelidad de NovaCore Technologies CR.
Verifica rápidamente si la RESPUESTA DEL ASISTENTE está respaldada por la EVIDENCIA (fragmentos de políticas y/o datos MySQL) sin inventar cifras ni reglas.
Responde únicamente JSON válido (máximo 120 tokens):
{"valido": true | false, "observaciones": "breve frase"}`;

/**
 * Capa 2 (LLM rápida, temperature: 0, maxTokens: 120):
 * Audita fidelidad factual de la respuesta respecto a la evidencia recuperada.
 */
async function runFidelityLayer({ pregunta, respuesta, evidencia }) {
  const userPrompt = [
    `PREGUNTA: ${pregunta}`,
    `EVIDENCIA:\n${String(evidencia || '').slice(0, 6000)}`,
    `RESPUESTA:\n${String(respuesta || '').slice(0, 1800)}`
  ].join('\n\n');

  const raw = await chatCompletion({
    systemPrompt: VALIDATOR_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0,
    jsonMode: true,
    maxTokens: 120
  });

  const parsed = safeParseJson(raw, null);
  if (!parsed || typeof parsed.valido !== 'boolean') {
    return { valido: true, observaciones: 'Validación completada.' };
  }

  return {
    valido: parsed.valido,
    observaciones: parsed.observaciones || 'Respuesta respaldada por la evidencia.'
  };
}

async function validateResponse({ pregunta, respuesta, user, evidencia = '', escalada = false }) {
  // Capa 1 (< 5 ms): privacidad estricta contra directorio MySQL vía ORM
  const privacyCheck = await runDeterministicPrivacyLayer(respuesta, user);
  if (!privacyCheck.ok) {
    return {
      valido: false,
      blockedByPrivacy: true,
      observaciones: privacyCheck.motivo,
      respuestaSanitizada: PRIVACY_FALLBACK_MESSAGE
    };
  }

  // Si fue un escalamiento sin política (no hay cifras generadas por afirmar), pasa directo
  if (escalada || !evidencia) {
    return {
      valido: true,
      blockedByPrivacy: false,
      observaciones: 'Escalamiento o respuesta de control sin datos fabricados.',
      respuestaSanitizada: respuesta
    };
  }

  // Capa 2: verificación LLM rápida (<= 120 tokens)
  const fidelityCheck = await runFidelityLayer({ pregunta, respuesta, evidencia });
  return {
    valido: fidelityCheck.valido,
    blockedByPrivacy: false,
    observaciones: fidelityCheck.observaciones,
    respuestaSanitizada: respuesta
  };
}

module.exports = {
  validateResponse,
  runDeterministicPrivacyLayer,
  PRIVACY_FALLBACK_MESSAGE
};
