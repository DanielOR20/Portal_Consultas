'use strict';

const { Op } = require('sequelize');
const { PalabraClave } = require('../models');
const { chatCompletion } = require('../config/llmClient');
const { generateEmbedding } = require('../rag/embeddingService');
const vectorStore = require('../rag/vectorStore');
const { safeParseJson } = require('../utils/jsonHelper');

const NO_POLICY_MESSAGE =
  'No encontré una política vigente en los documentos oficiales de NovaCore que respalde esa consulta. ¿Deseas que escale tu caso con un especialista de Talento Humano?';

const SYSTEM_PROMPT = `Eres el Agente Especialista en Políticas Internas y Legislación Laboral de NovaCore Technologies Costa Rica S.A.
Responde la consulta del colaborador ÚNICAMENTE utilizando la información contenida en los FRAGMENTOS OFICIALES proporcionados.

REGLAS ESTRICTAS:
1. Cero alucinación: No inventes cifras, plazos, beneficios, bonos, artículos legales ni procedimientos que no aparezcan textualmente en los fragmentos.
2. Si los fragmentos recuperados NO contienen respuesta para la consulta (por ejemplo, si preguntan por un bono, subsidio o beneficio inexistente en los documentos), debes responder con "encontrada": false.
3. Cuando "encontrada": true, redacta una respuesta clara, formal, precisa y directa en español citando las cifras exactas y mencionando el título del documento, código/versión, sección y fecha de vigencia cuando aparezcan en los metadatos.
4. Indica en "indices_usados" los números de índice [i] de los fragmentos que respaldan tu respuesta.

Devuelve exclusivamente un JSON válido con esta estructura:
{
  "encontrada": true,
  "respuesta": "Texto de la respuesta en español",
  "indices_usados": [0]
}`;

let policyTermsCache = { data: null, loadedAt: 0 };
const CACHE_TTL_MS = 60 * 1000;

function invalidatePolicyTermsCache() {
  policyTermsCache = { data: null, loadedAt: 0 };
}

async function getDbPolicyTerms() {
  const now = Date.now();
  if (policyTermsCache.data && now - policyTermsCache.loadedAt < CACHE_TTL_MS) {
    return policyTermsCache.data;
  }

  const rows = await PalabraClave.findAll({
    where: {
      activa: true,
      categoria: { [Op.in]: ['politica', 'tema_dashboard'] }
    },
    attributes: ['palabra', 'tema_asociado'],
    raw: true
  });

  policyTermsCache = { data: rows, loadedAt: now };
  return rows;
}

function normalizeStr(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function resolveThemeBoostTerms(pregunta) {
  const rows = await getDbPolicyTerms();
  const normalizedQuestion = normalizeStr(pregunta);
  const matchedThemes = new Set();

  for (const row of rows) {
    const kw = normalizeStr(row.palabra);
    if (kw && normalizedQuestion.includes(kw) && row.tema_asociado) {
      matchedThemes.add(row.tema_asociado);
    }
  }

  if (matchedThemes.size === 0) return [];

  const boostTerms = [];
  for (const row of rows) {
    if (matchedThemes.has(row.tema_asociado)) {
      boostTerms.push(row.palabra);
    }
  }
  return boostTerms;
}

function formatHistorial(historial) {
  if (!Array.isArray(historial) || historial.length === 0) return '';
  const recent = historial.slice(-4);
  return recent
    .map((m) => `${m.role === 'assistant' ? 'Asistente' : 'Colaborador'}: ${m.content}`)
    .join('\n');
}

function buildDeduplicatedCitations(hits, indicesUsados) {
  const validIndexes = Array.isArray(indicesUsados)
    ? indicesUsados.filter((i) => Number.isInteger(i) && i >= 0 && i < hits.length)
    : [];
  const selectedHits = validIndexes.length > 0 ? validIndexes.map((i) => hits[i]) : [hits[0]];

  const seen = new Set();
  const citas = [];

  for (const hit of selectedHits) {
    if (!hit || !hit.metadata) continue;
    const meta = hit.metadata;
    const key = `${meta.titulo}::${meta.codigo_version}::${meta.seccion}`;
    if (seen.has(key)) continue;
    seen.add(key);

    citas.push({
      titulo: meta.titulo || meta.fileName,
      codigo_version: meta.codigo_version || 'N/D',
      seccion: meta.seccion || 'Información General',
      fecha_vigencia: meta.fecha_vigencia || 'N/D',
      responsable: meta.responsable || 'Dirección de Talento Humano',
      enlace: meta.webViewLink || ''
    });
  }

  return citas;
}

async function runPoliticasAgent(pregunta, historial = []) {
  const [queryEmbedding, boostTerms] = await Promise.all([
    generateEmbedding(pregunta),
    resolveThemeBoostTerms(pregunta)
  ]);

  const hits = vectorStore.searchSimilar(queryEmbedding, 7, 0.38, pregunta, boostTerms);

  if (!hits || hits.length === 0) {
    return {
      encontrada: false,
      escalada: true,
      respuesta: NO_POLICY_MESSAGE,
      citas: []
    };
  }

  const contextBlocks = hits
    .map((hit, idx) => {
      const m = hit.metadata || {};
      return [
        `[${idx}] Documento: ${m.titulo || m.fileName}`,
        `Código/Versión: ${m.codigo_version || 'N/D'} | Vigencia: ${m.fecha_vigencia || 'N/D'} | Responsable: ${m.responsable || 'N/D'}`,
        `Sección: ${m.seccion || 'General'} | Similitud: ${hit.score}`,
        `Contenido:\n${hit.text}`
      ].join('\n');
    })
    .join('\n\n---\n\n');

  const historialText = formatHistorial(historial);
  const userPrompt = [
    historialText ? `HISTORIAL RECIENTE:\n${historialText}\n` : '',
    `PREGUNTA DEL COLABORADOR:\n${pregunta}`,
    `\nFRAGMENTOS OFICIALES RECUPERADOS:\n${contextBlocks}`
  ]
    .filter(Boolean)
    .join('\n');

  const rawOutput = await chatCompletion({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.1,
    jsonMode: true
  });

  const parsed = safeParseJson(rawOutput, null);
  if (!parsed || parsed.encontrada === false || !parsed.respuesta) {
    return {
      encontrada: false,
      escalada: true,
      respuesta: NO_POLICY_MESSAGE,
      citas: []
    };
  }

  const citas = buildDeduplicatedCitations(hits, parsed.indices_usados);
  const validIndexes = Array.isArray(parsed.indices_usados)
    ? parsed.indices_usados.filter((i) => Number.isInteger(i) && i >= 0 && i < hits.length)
    : [];
  const usedHits = validIndexes.length > 0 ? validIndexes.map((i) => hits[i]) : hits.slice(0, 2);
  const evidencia = usedHits
    .map((h) => `[${h.metadata?.codigo_version}] ${h.text}`)
    .join('\n---\n');

  return {
    encontrada: true,
    escalada: false,
    respuesta: parsed.respuesta.trim(),
    citas,
    evidencia
  };
}

module.exports = {
  runPoliticasAgent,
  resolveThemeBoostTerms,
  invalidatePolicyTermsCache,
  NO_POLICY_MESSAGE
};
