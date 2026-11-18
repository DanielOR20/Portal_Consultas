'use strict';

const { ConsultaChat, PalabraClave } = require('../models');
const { chatCompletion } = require('../config/llmClient');
const { runPoliticasAgent, invalidatePolicyTermsCache } = require('./politicasAgent');
const { runDatosAgent } = require('./datosAgent');
const { runAccionRrhhAgent } = require('./accionRrhhAgent');
const { validateResponse } = require('./validadorAgent');
const { safeParseJson } = require('../utils/jsonHelper');

const VALID_INTENTS = [
  'politica',
  'dato_personal',
  'mixta',
  'accion_rrhh',
  'restringida',
  'fuera_alcance'
];

const RESTRINGIDA_MESSAGE =
  'Por políticas de privacidad y protección de datos (Ley N.° 8968), no estoy autorizado para compartir información personal, salarial ni saldos de otros colaboradores.';

const RBAC_ADMIN_DENIED_MESSAGE =
  'Por control de acceso por roles (RBAC), no tienes permisos para ejecutar acciones administrativas de Talento Humano. Esa función es exclusiva de la Dirección de RRHH.';

const ADMIN_WRITE_RX =
  /\b(aprueba|aprobar|rechaza|rechazar|acredita|acreditar|descuenta|descontar|fija\s+el\s+saldo|desactiva|desactivar|da\s+de\s+baja|dar\s+de\s+baja|reactiva|reactivar|elimina|eliminar|quita|quitar|agrega|agregar|crea\s+un|registra\s+(?:un|una|al|el)\b|resuelve|resolver|regenera|regenerar)\b/i;
const ADMIN_TARGET_RX =
  /\b(solicitud|vacaciones|saldo|colaborador|empleado|ticket|palabra\s+clave|reporte\s+diario|incapacidad)\b/i;

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

function evaluateDeterministicGuardrail(pregunta, grouped, userRol = 'colaborador') {
  const normQ = normalizeText(pregunta);

  const restringidaMatches = grouped.restringida.filter((kw) => containsKeyword(normQ, kw));
  const fueraAlcanceMatches = grouped.fuera_alcance.filter((kw) => containsKeyword(normQ, kw));
  const politicaMatches = grouped.politica.filter((kw) => containsKeyword(normQ, kw));
  const datoPersonalMatches = grouped.dato_personal.filter((kw) => containsKeyword(normQ, kw));

  // Bloqueo estricto de privacidad de terceros y acciones administrativas para colaboradores estándar
  if (userRol !== 'rrhh') {
    if (ADMIN_WRITE_RX.test(normQ) && ADMIN_TARGET_RX.test(normQ)) {
      return 'rbac_admin_denied';
    }

    if (restringidaMatches.length > 0) {
      const hasMultipleRestricted = restringidaMatches.length >= 2;
      const hasRelationalPhrase = restringidaMatches.some((kw) => kw.includes(' '));
      const hasOwnOrPolicyContext = politicaMatches.length > 0 || datoPersonalMatches.length > 0;

      if (hasMultipleRestricted || (hasRelationalPhrase && !hasOwnOrPolicyContext) || !hasOwnOrPolicyContext) {
        return 'restringida';
      }
    }
  }

  if (
    fueraAlcanceMatches.length > 0 &&
    politicaMatches.length === 0 &&
    datoPersonalMatches.length === 0 &&
    (userRol !== 'rrhh' || restringidaMatches.length === 0)
  ) {
    return 'fuera_alcance';
  }

  return null;
}

function buildClassifierPrompt(userRol, grouped) {
  const rrhhRules =
    userRol === 'rrhh'
      ? `CONTEXTO PRIVILEGIADO DE ROL ("rrhh" - Dirección de Talento Humano):
- Este usuario ESTÁ AUTORIZADO para consultar registros nominales Y ejecutar acciones administrativas reales sobre solicitudes, colaboradores, saldos de vacaciones, incapacidades, tickets, palabras clave y regeneración de reportes.
- Distingue claramente:
  * Preguntas normativas sobre políticas o leyes laborales -> "politica".
  * Consultas o reportes de lectura ("cuántas personas...", "lista de...", "reporte manual de las últimas 3 personas ausentes...") -> "dato_personal".
  * Órdenes, propuestas o confirmaciones para modificar datos o ejecutar operaciones ("aprueba...", "rechaza...", "agrega...", "crea colaborador...", "edita...", "desactiva...", "acredita/descuenta/fija saldo...", "registra incapacidad...", "resuelve/cierra ticket...", "quita/elimina palabra clave...", "regenera el reporte diario", "vamos a aprobar...", o confirmaciones breves como "sí", "confirmo", "apruébala", "hazlo" tras una propuesta del turno previo) -> "accion_rrhh".`
      : `REGLA ESTRICTA DE PRIVACIDAD Y RBAC PARA ROL ("colaborador"):
- Este usuario NO puede acceder a datos individuales, saldos, incapacidades, ausencias ni salarios de otros colaboradores o directivos, NI ejecutar acciones administrativas; cualquiera de esos casos DEBE clasificarse como "restringida".`;

  return `Eres el Agente Orquestador del Portal Interno de Talento Humano de NovaCore Technologies Costa Rica S.A.
El usuario autenticado actual tiene el rol: "${userRol}".

${rrhhRules}

Referencias dinámicas cargadas desde la base de datos (palabras_clave):
- Términos de política: ${grouped.politica.join(', ')}
- Términos de dato personal: ${grouped.dato_personal.join(', ')}
- Indicadores de privacidad/restringida: ${grouped.restringida.join(', ')}
- Indicadores fuera de alcance: ${grouped.fuera_alcance.join(', ')}

Clasifica la consulta del usuario en EXACTAMENTE UNA categoría y responde únicamente con un JSON válido:

1. "politica": Preguntas sobre reglas generales, políticas internas de NovaCore o legislación laboral de Costa Rica (incluye consultas si la empresa ofrece algún bono/beneficio inexistente).
2. "dato_personal": Consultas de lectura sobre registros propios del usuario (saldo, solicitudes, incapacidades, próximo pago, evaluación, puesto) o consultas/reportes informativos de lectura para rol "rrhh".
3. "mixta": Preguntas que combinan consultar datos de MySQL Y una regla de política normativa.
4. "restringida": ÚNICAMENTE cuando rol === "colaborador": datos personales/salarios de terceros, conteos globales de empresa, o intentos de ejecutar acciones administrativas RRHH.
5. "fuera_alcance": Temas completamente ajenos a Recursos Humanos o gestión laboral (películas, clima, recetas, chistes, programación).
${
  userRol === 'rrhh'
    ? '6. "accion_rrhh": ÚNICAMENTE cuando rol === "rrhh": órdenes, propuestas o confirmaciones para ejecutar acciones administrativas (aprobar/rechazar solicitudes, crear/editar/desactivar colaboradores, ajustar vacaciones, registrar incapacidades, resolver tickets, gestionar palabras clave o regenerar reporte diario).'
    : ''
}

Responde exclusivamente en formato JSON:
{
  "intencion": "politica" | "dato_personal" | "mixta" | "accion_rrhh" | "restringida" | "fuera_alcance",
  "razon": "Justificación breve"
}`;
}

const MIXED_SYNTHESIS_PROMPT = `Eres el Agente Orquestador de NovaCore Technologies Costa Rica S.A.
Debes combinar en una sola respuesta clara, estructurada y amable en español:
1. Los DATOS PERSONALES exactos obtenidos de MySQL (sin modificar ni redondear cifras ni fechas).
2. Las REGLAS DE POLÍTICA obtenidas de los documentos oficiales (conservando las cifras exactas y citando título, código/versión y sección).

No inventes datos adicionales ni alteres cifras.`;

async function classifyIntent(pregunta, userRol, grouped, historial = []) {
  const guardrailIntent = evaluateDeterministicGuardrail(pregunta, grouped, userRol);
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
  const classification = await classifyIntent(pregunta, user.rol, groupedKeywords, historial);

  let intencion = classification.intencion;
  let isRbacAdminDenied = false;

  if (intencion === 'rbac_admin_denied') {
    intencion = 'restringida';
    isRbacAdminDenied = true;
  } else if (intencion === 'accion_rrhh' && user.rol !== 'rrhh') {
    intencion = 'restringida';
    isRbacAdminDenied = true;
  }

  let respuesta = '';
  let agente = 'AgenteOrquestador';
  let citas = [];
  let resuelta = true;
  let escalada = false;
  let accionEjecutada = false;
  let evidencia = '';

  if (intencion === 'restringida') {
    respuesta = isRbacAdminDenied ? RBAC_ADMIN_DENIED_MESSAGE : RESTRINGIDA_MESSAGE;
    agente = 'OrquestadorGuardrail';
    resuelta = true;
    escalada = false;
  } else if (intencion === 'fuera_alcance') {
    respuesta = FUERA_ALCANCE_MESSAGE;
    agente = 'OrquestadorGuardrail';
    resuelta = true;
    escalada = false;
  } else if (intencion === 'accion_rrhh') {
    const accionResult = await runAccionRrhhAgent(pregunta, user, historial, {
      invalidateCaches: () => {
        invalidateKeywordsCache();
        invalidatePolicyTermsCache();
      }
    });
    respuesta = accionResult.respuesta;
    evidencia = accionResult.evidencia || '';
    accionEjecutada = Boolean(accionResult.accionEjecutada);
    agente = 'AgenteAccionesRRHH';
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
    accionEjecutada,
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
