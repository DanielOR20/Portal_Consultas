'use strict';

const { ConsultaChat, PalabraClave } = require('../models');
const { chatCompletion } = require('../config/llmClient');
const { runPoliticasAgent } = require('./politicasAgent');
const { runDatosAgent } = require('./datosAgent');
const { validateResponse } = require('./validadorAgent');
const { safeParseJson } = require('../utils/jsonHelper');

const VALID_INTENTS = [
  'politica',
  'dato_personal',
  'mixta',
  'restringida',
  'fuera_alcance'
];

const RESTRINGIDA_MESSAGE =
  'Por políticas de privacidad y protección de datos (Ley N.° 8968), no estoy autorizado para compartir información personal, salarial ni saldos de otros colaboradores.';

const FUERA_ALCANCE_MESSAGE =
  'Soy el asistente interno de Talento Humano de NovaCore. Solo puedo ayudarte con consultas sobre políticas laborales, beneficios o tu información personal de colaborador.';

const CACHE_TTL_MS = 60 * 1000;
let keywordsCache = { grouped: null, loadedAt: 0 };

function invalidateKeywordsCache() {
  keywordsCache = { grouped: null, loadedAt: 0 };
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsKeyword(normalizedText, keyword) {
  const normKw = normalizeText(keyword);
  if (!normKw) return false;
  const rx = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(normKw)}(?:$|[^a-z0-9])`, 'i');
  return rx.test(normalizedText);
}

async function getActiveKeywordsGrouped() {
  const now = Date.now();
  if (keywordsCache.grouped && now - keywordsCache.loadedAt < CACHE_TTL_MS) {
    return keywordsCache.grouped;
  }

  const rows = await PalabraClave.findAll({
    where: { activa: true },
    attributes: ['palabra', 'categoria', 'tema_asociado'],
    raw: true
  });

  const grouped = {
    restringida: [],
    fuera_alcance: [],
    politica: [],
    dato_personal: [],
    tema_dashboard: []
  };

  for (const row of rows) {
    if (grouped[row.categoria]) {
      grouped[row.categoria].push(row.palabra);
    }
  }

  keywordsCache = { grouped, loadedAt: now };
  return grouped;
}

function evaluateDeterministicGuardrail(pregunta, grouped) {
  const normQ = normalizeText(pregunta);

  const restringidaMatches = grouped.restringida.filter((kw) => containsKeyword(normQ, kw));
  const fueraAlcanceMatches = grouped.fuera_alcance.filter((kw) => containsKeyword(normQ, kw));
  const politicaMatches = grouped.politica.filter((kw) => containsKeyword(normQ, kw));
  const datoPersonalMatches = grouped.dato_personal.filter((kw) => containsKeyword(normQ, kw));

  // Si coincide con términos restringidos de MySQL y no coexiste un contexto claro de política/dato propio sin terceros
  if (restringidaMatches.length > 0) {
    const hasMultipleRestricted = restringidaMatches.length >= 2;
    const hasRelationalPhrase = restringidaMatches.some((kw) => kw.includes(' '));
    const hasOwnOrPolicyContext = politicaMatches.length > 0 || datoPersonalMatches.length > 0;

    if (hasMultipleRestricted || (hasRelationalPhrase && !hasOwnOrPolicyContext) || !hasOwnOrPolicyContext) {
      return 'restringida';
    }
  }

  if (
    fueraAlcanceMatches.length > 0 &&
    politicaMatches.length === 0 &&
    datoPersonalMatches.length === 0
  ) {
    return 'fuera_alcance';
  }

  return null;
}

function buildClassifierPrompt(userRol, grouped) {
  return `Eres el Agente Orquestador del Portal Interno de Talento Humano de NovaCore Technologies Costa Rica S.A.
El usuario autenticado actual tiene el rol: "${userRol}".

Referencias dinámicas cargadas desde la base de datos (palabras_clave):
- Términos de política: ${grouped.politica.join(', ')}
- Términos de dato personal: ${grouped.dato_personal.join(', ')}
- Indicadores de privacidad/restringida: ${grouped.restringida.join(', ')}
- Indicadores fuera de alcance: ${grouped.fuera_alcance.join(', ')}

Clasifica la consulta del usuario en EXACTAMENTE UNA de estas 5 categorías y responde únicamente con un JSON válido:

1. "politica": Preguntas sobre reglas generales, políticas internas de NovaCore o legislación laboral de Costa Rica. Incluye preguntas sobre si la empresa ofrece algún bono, subsidio o beneficio específico (aunque no exista en el catálogo), así como consultas generales en primera persona sobre reglas normativas (ej. "¿qué incluye mi liquidación si me despiden?", "me incapacitaron 5 días, ¿quién paga?", "¿cuánto me descuentan de planilla por CCSS?", "¿cuáles son mis derechos ARCO?").
2. "dato_personal": Preguntas sobre los registros propios actuales del usuario autenticado en MySQL (su saldo actual de vacaciones, estado de sus solicitudes, incapacidades registradas, fecha de su próximo pago, fecha de su próxima evaluación, puesto o fecha de ingreso). Si el usuario tiene rol "rrhh", también incluye métricas o conteos agregados generales de la empresa.
3. "mixta": Preguntas que combinan explícitamente consultar un dato personal de MySQL del usuario (ej. su saldo actual, su próximo pago, sus incapacidades registradas) Y una regla de política normativa.
4. "restringida": Preguntas que piden datos personales, salariales, evaluaciones, incapacidades o saldos de OTRO colaborador o directivo específico, o conteos globales de otros empleados cuando el usuario NO tiene rol "rrhh".
5. "fuera_alcance": Temas completamente ajenos a Recursos Humanos, beneficios laborales o NovaCore (ej. películas, clima, recetas, chistes, programación).

Responde exclusivamente en formato JSON:
{
  "intencion": "politica" | "dato_personal" | "mixta" | "restringida" | "fuera_alcance",
  "razon": "Justificación breve"
}`;
}

const MIXED_SYNTHESIS_PROMPT = `Eres el Agente Orquestador de NovaCore Technologies Costa Rica S.A.
Debes combinar en una sola respuesta clara, estructurada y amable en español:
1. Los DATOS PERSONALES exactos obtenidos de MySQL (sin modificar ni redondear cifras ni fechas).
2. Las REGLAS DE POLÍTICA obtenidas de los documentos oficiales (conservando las cifras exactas y citando título, código/versión y sección).

No inventes datos adicionales ni alteres cifras.`;

async function classifyIntent(pregunta, userRol, grouped, historial = []) {
  const guardrailIntent = evaluateDeterministicGuardrail(pregunta, grouped);
  if (guardrailIntent) {
    return { intencion: guardrailIntent, via: 'db_guardrail' };
  }

  const historialText = Array.isArray(historial) && historial.length > 0
    ? historial
        .slice(-4)
        .map((m) => `${m.role === 'assistant' ? 'Asistente' : 'Colaborador'}: ${m.content}`)
        .join('\n')
    : '';

  const userPrompt = [
    historialText ? `HISTORIAL RECIENTE:\n${historialText}\n` : '',
    `CONSULTA ACTUAL DEL USUARIO:\n${pregunta}`
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await chatCompletion({
    systemPrompt: buildClassifierPrompt(userRol, grouped),
    userPrompt,
    temperature: 0,
    jsonMode: true
  });

  const parsed = safeParseJson(raw, {});
  const intencion = VALID_INTENTS.includes(parsed?.intencion)
    ? parsed.intencion
    : 'politica';

  return { intencion, via: 'llm_classifier' };
}

async function runOrquestadorAgent(pregunta, user, historial = []) {
  const startTime = Date.now();
  const groupedKeywords = await getActiveKeywordsGrouped();
  const { intencion } = await classifyIntent(pregunta, user.rol, groupedKeywords, historial);

  let respuesta = '';
  let agente = 'AgenteOrquestador';
  let citas = [];
  let resuelta = true;
  let escalada = false;
  let evidencia = '';

  if (intencion === 'restringida') {
    respuesta = RESTRINGIDA_MESSAGE;
    agente = 'OrquestadorGuardrail';
    resuelta = true;
    escalada = false;
  } else if (intencion === 'fuera_alcance') {
    respuesta = FUERA_ALCANCE_MESSAGE;
    agente = 'OrquestadorGuardrail';
    resuelta = true;
    escalada = false;
  } else if (intencion === 'politica') {
    const polResult = await runPoliticasAgent(pregunta, historial);
    respuesta = polResult.respuesta;
    citas = polResult.citas || [];
    resuelta = polResult.encontrada;
    escalada = polResult.escalada;
    evidencia = polResult.evidencia || '';
    agente = 'AgentePoliticasRAG';
  } else if (intencion === 'dato_personal') {
    const datosResult = await runDatosAgent(pregunta, user, historial);
    respuesta = datosResult.respuesta;
    evidencia = JSON.stringify(datosResult.contextoDatos || {});
    agente = 'AgenteDatosColaborador';
    resuelta = true;
    escalada = false;
  } else if (intencion === 'mixta') {
    const [datosResult, polResult] = await Promise.all([
      runDatosAgent(pregunta, user, historial),
      runPoliticasAgent(pregunta, historial)
    ]);

    citas = polResult.citas || [];
    resuelta = polResult.encontrada;
    escalada = polResult.escalada;
    agente = 'AgenteOrquestadorMixto';
    evidencia = `${JSON.stringify(datosResult.contextoDatos || {})}\n\n${polResult.evidencia || ''}`;

    const synthesisPrompt = [
      `PREGUNTA ORIGINAL:\n${pregunta}`,
      `\nRESPUESTA DEL AGENTE DE DATOS PERSONALES (MYSQL):\n${datosResult.respuesta}`,
      `\nRESPUESTA DEL AGENTE DE POLÍTICAS (RAG DRIVE):\n${polResult.respuesta}`,
      citas.length > 0
        ? `\nDOCUMENTOS CITADOS:\n${citas
            .map((c) => `- ${c.titulo} (${c.codigo_version}, sección: ${c.seccion})`)
            .join('\n')}`
        : ''
    ]
      .filter(Boolean)
      .join('\n');

    respuesta = (
      await chatCompletion({
        systemPrompt: MIXED_SYNTHESIS_PROMPT,
        userPrompt: synthesisPrompt,
        temperature: 0.1,
        jsonMode: false,
        maxTokens: 450
      })
    ).trim();
  }

  // Agente Validador (Capa 1 ORM determinista < 5ms + Capa 2 LLM rápida)
  const validation = await validateResponse({
    pregunta,
    respuesta,
    user,
    evidencia,
    escalada
  });

  if (validation.blockedByPrivacy) {
    respuesta = validation.respuestaSanitizada;
    citas = [];
    escalada = false;
    resuelta = true;
    agente = 'ValidadorGuardrail';
  }

  const latencia_ms = Date.now() - startTime;

  const consultaRecord = await ConsultaChat.create({
    colaborador_id: user.id,
    pregunta,
    intencion,
    agente,
    documentos_citados: citas,
    resuelta,
    escalada,
    latencia_ms,
    fecha: new Date()
  });

  return {
    consultaId: consultaRecord.id,
    respuesta,
    intencion,
    agente,
    citas,
    escalada,
    validado: validation.valido,
    validacion_observaciones: validation.observaciones,
    latencia_ms
  };
}

module.exports = {
  runOrquestadorAgent,
  invalidateKeywordsCache,
  RESTRINGIDA_MESSAGE,
  FUERA_ALCANCE_MESSAGE
};
