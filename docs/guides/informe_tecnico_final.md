# Informe Técnico Final — Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente

| Campo | Detalle |
| :--- | :--- |
| **Proyecto** | Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente (`Portal_Consultas`) |
| **Organización Modelo** | NovaCore Technologies Costa Rica S.A. (250 colaboradores · Sector Software B2B) |
| **Marco Normativo** | Legislación Laboral de la República de Costa Rica (Código de Trabajo Ley N.° 2 y leyes conexas) |
| **Versión / Fecha** | `v1.3` · 18 de noviembre de 2026 |
| **Repositorio Oficial** | `https://github.com/DanielOR20/Portal_Consultas.git` |

---

## 1. Resumen Ejecutivo y Arquitectura del Sistema

El **Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente** resuelve dos problemas críticos de operación en organizaciones tecnológicas de mediano tamaño como **NovaCore Technologies Costa Rica S.A.**:

1. **Autoservicio normativo y personal con trazabilidad verificable:** Permite a los colaboradores resolver dudas sobre políticas internas, legislación laboral costarricense y sus propios datos laborales (saldos de vacaciones, solicitudes, incapacidades, fechas de pago y evaluaciones) en segundos, citando exactamente el documento fuente, su código/versión, sección y enlace directo en Google Drive.
2. **Analítica operativa y detección de brechas para Talento Humano:** Genera de forma determinista y automatizada un reporte diario con 8 indicadores clave (ausentismo, atraso en aprobaciones, incapacidades CCSS/INS, rotación, riesgo de pasivo vacacional `> 20 días`, rendimiento del chatbot, brechas documentales y tendencia de 30 días), respaldado por un resumen ejecutivo redactado sin invención de cifras.

### 1.1 Desacoplamiento de Flujos

La arquitectura divide el sistema en dos planos independientes (detallados en [diagrama_arquitectura.md](../architecture/diagrama_arquitectura.md)):

- **Plano Síncrono (Tiempo Real):** Aplicación SPA en React + Vite (tema **Vino Fosforescente y Blanco Puro**, con dictado y lectura por voz mediante Web Speech API) comunicada vía REST/JWT con Express. El **Agente Orquestador** clasifica cada consulta apoyado en la tabla dinámica `palabras_clave`, la enruta hacia el **Agente de Políticas RAG**, el **Agente de Datos del Colaborador** o ambos en paralelo (`Promise.all`), y somete la salida al **Agente Validador** (privacidad ORM + fidelidad LLM) antes de devolverla y registrarla en `consultas_chat`. Cuando no existe respaldo documental, el **Agente de Escalamiento** permite crear tickets reales en `tickets_rrhh`.
- **Plano Asíncrono / Programado (`node-cron`):**
  - **Cada hora (`driveSyncJob.js`):** El **Agente de Ingesta** consulta Google Drive API v3 (`drive.changes` y listado de carpeta) para detectar altas, modificaciones y eliminaciones de documentos en Docs, Sheets y PDF, regenerando *chunks* y *embeddings* únicamente cuando existen cambios.
  - **07:00 a.m. (`dailyReportJob.js`):** El **Agente Analista** calcula determinísticamente en SQL/Sequelize los 8 KPIs diarios, solicita a DeepSeek un resumen ejecutivo de 3 a 5 frases basado exclusivamente en el JSON calculado y guarda el reporte en `reportes_diarios`.

---

## 2. Justificación del Stack Tecnológico

| Capa | Tecnología Elegida | Justificación Técnica y Operativa |
| :--- | :--- | :--- |
| **Backend API** | Node.js (CommonJS) + Express 4 | Ecosistema unificado en JavaScript entre frontend y backend, arranque ligero, compatibilidad directa con `sequelize-cli`, `pdf-parse` y `googleapis`, y manejo asíncrono eficiente para llamadas concurrentes en consultas mixtas. |
| **Base de Datos Relacional** | MySQL 8.0 + Sequelize ORM (`mysql2`) | Integridad referencial estricta entre las **9 tablas** del portal (`colaboradores`, `saldos_vacaciones`, `solicitudes`, `incapacidades`, `movimientos_personal`, `consultas_chat`, `reportes_diarios`, `palabras_clave` y `tickets_rrhh`), migraciones versionadas reproducibles, CRUD en tiempo real de palabras clave con invalidación de caché, flujo completo de tickets y consultas **100 % vía Sequelize ORM (cero SQL crudo)** en toda la aplicación. |
| **Seguridad y Validación** | `jsonwebtoken` + `bcryptjs` + `zod` | Autenticación *stateless* con expiración configurable (`8h`), hashing seguro de contraseñas con salt y validación estructural estricta de entradas en endpoints críticos (`/api/auth/login`, `/api/chat`). |
| **Modelo de Lenguaje (LLM)** | DeepSeek API (`deepseek-chat`) vía SDK `openai` | Excelente relación costo/latencia y soporte nativo de `response_format: { type: 'json_object' }`, indispensable para clasificación determinista de intenciones (`T=0`) y respuestas estructuradas con verificación de cobertura documental (`T=0.1`). |
| **Embeddings Multilingües** | `@xenova/transformers` (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`) | DeepSeek no provee API de embeddings; este modelo ONNX local de 384 dimensiones optimizado para texto multilingüe (incluyendo español) opera sin dependencias externas en la nube, sin costo por token de indexación y con latencia ~30–50 ms por consulta tras su carga inicial. |
| **Almacenamiento Vectorial** | Vector Store JSON persistente (`backend/vector_store/vectors.json`) | Para una base normativa corporativa de 10 documentos oficiales (~31 fragmentos vectorizados de 384 dimensiones), un almacén persistente en memoria + disco con búsqueda híbrida (coseno + refuerzo léxico) ofrece latencia sub-milisegundo sin requerir levantar un contenedor Docker adicional para ChromaDB en desarrollo local, manteniendo compatibilidad arquitectónica con una futura migración a base vectorial distribuida. |
| **Frontend & Visualización** | React 18 + Vite 6 + Tailwind CSS v4 + Chart.js | Compilación rápida (`5.87s`), sistema de diseño corporativo luminoso en **Vino Fosforescente y Blanco Puro** (`#E6004C`, `#FF1764`, `#FFF0F5`, `#FFFFFF`, `#F8F9FB`), interacción por voz (`SpeechRecognition` + `speechSynthesis`), notificaciones Toast, tickets en vivo en `/chat` y `/dashboard` (3 pestañas y modal de resolución), gestor visual CRUD de `palabras_clave`, exportación de reportes CSV/JSON y gráficos interactivos (`Line`, `Bar`, `Doughnut`). |

---

## 3. Diseño Multiagente, Control de Acceso por Roles (RBAC) y Prompts Versionados

### 3.1 Los 7 Agentes Especializados

1. **`ingestaAgent.js` (Agente de Ingesta):** Mantiene sincronizado el índice vectorial con la carpeta oficial de Google Drive mediante `sync_state.json` y `drive.changes.getStartPageToken` / `changes.list`, asegurando eliminación de vectores huérfanos cuando un documento es borrado o movido.
2. **`orquestadorAgent.js` (Agente Orquestador):** Consulta las palabras clave activas desde `palabras_clave` vía Sequelize ORM (caché 60 s con invalidación inmediata vía `invalidateKeywordsCache()`), clasifica la consulta en 5 intenciones (`politica`, `dato_personal`, `mixta`, `restringida`, `fuera_alcance`), aplica guardrails deterministas tempranos, ejecuta paralelismo con `Promise.all` en consultas mixtas y registra trazabilidad completa en `consultas_chat`.
3. **`politicasAgent.js` (Agente de Políticas RAG):** Ejecuta recuperación híbrida (`topK = 7`, `minScore = 0.38`) con expansión temática dinámica desde `palabras_clave` (`invalidatePolicyTermsCache()`) y obliga al LLM a responder en `jsonMode` indicando `"encontrada": true | false` y `"indices_usados"`. Si no hay evidencia documental suficiente, devuelve `escalada: true` sin inventar información.
4. **`datosAgent.js` (Agente de Datos del Colaborador):** Consulta MySQL vía Sequelize ORM en modo solo lectura filtrando por `colaborador_id = req.user.id`. Ejecuta en JavaScript determinista el cálculo de próxima quincena hábil y próxima evaluación semestral (o fin de periodo de prueba de 90 días), y solo adjunta conteos agregados globales si `user.rol === 'rrhh'`.
5. **`validadorAgent.js` (Agente Validador):** Audita cada respuesta antes de entregarla mediante **Capa 1 determinista ORM (`< 5 ms`)** contra el directorio de `Colaborador` (evitando fugas de nombres/correos de terceros para `rol !== 'rrhh'`) y **Capa 2 LLM rápida (`T=0`, `max_tokens: 120`)** verificando fidelidad estricta a los fragmentos o registros recuperados (`validado: true`).
6. **`escalamientoAgent.js` (Agente de Escalamiento):** Crea tickets formales en `tickets_rrhh` con folios correlativos (`TKT-2026-XXX`) vía `TicketRRHH.count()` y `TicketRRHH.create()` cuando el colaborador confirma el escalamiento desde el chat (`POST /api/tickets`).
7. **`analistaAgent.js` (Agente Analista de Reportes):** Calcula los 8 indicadores diarios exclusivamente mediante consultas Sequelize ORM agregadas (clasificando el Top 5 de temas dinámicamente desde `palabras_clave`) y utiliza DeepSeek (`T=0.2`) únicamente para redactar la síntesis ejecutiva de 3 a 5 frases.

### 3.2 Control de Acceso por Roles (RBAC) y Protección de Privacidad

El sistema implementa defensa en profundidad en cuatro niveles:

| Nivel | Mecanismo Implementado | Garantía |
| :--- | :--- | :--- |
| **1. Autenticación HTTP** | `authMiddleware.js` verifica JWT Bearer y adjunta `{ id, email, nombre, departamento, rol }` desde el token firmado. | Bloquea cualquier petición anónima (`401 Unauthorized`). |
| **2. Autorización por Ruta** | `roleMiddleware.js` (`requireRole('rrhh')`) protege `POST /api/ingest/sync`, `GET /api/dashboard/latest`, `GET /api/dashboard/history` y `POST /api/dashboard/generate`. | Un `colaborador` recibe `403 Forbidden` en endpoints administrativos y es redirigido en frontend por `ProtectedRoute.jsx`. |
| **3. Guardrail Semántico** | El Orquestador clasifica preguntas sobre terceros o salarios individuales como `restringida` (y consultas globales de personal si `rol !== 'rrhh'`) rechazando en ~1 s con cita a la **Ley N.° 8968**. | **0 fugas** sin siquiera consultar tablas de terceros ni invocar subagentes. |
| **4. Aislamiento en Capa ORM** | `datosAgent.js` filtra todas las consultas personales con `where: { colaborador_id: user.id }`. Solo desbloquea conteos agregados (`COUNT` sin salarios) cuando `user.rol === 'rrhh'`. | Imposibilidad estructural de exponer datos de otros colaboradores aunque el clasificador fallara. |

### 3.3 Gobernanza de Prompts Versionados (`docs/prompts/`)

Los seis prompts y especificaciones de agentes se mantienen documentados y versionados en `v1.0`:
- [orquestador_v1.md](../prompts/orquestador_v1.md) — Clasificación en 5 categorías enriquecida desde `palabras_clave` (`T=0`, `jsonMode`) y síntesis mixta (`T=0.1`).
- [politicas_rag_v1.md](../prompts/politicas_rag_v1.md) — Grounding estricto en fragmentos recuperados, citas obligatorias y escalamiento ante ausencia documental (`T=0.1`, `jsonMode`).
- [datos_colaborador_v1.md](../prompts/datos_colaborador_v1.md) — Respuesta estricta sobre contexto JSON de MySQL (`T=0.1`).
- [analista_reportes_v1.md](../prompts/analista_reportes_v1.md) — Síntesis ejecutiva de 3 a 5 frases sin alteración de cifras ORM (`T=0.2`).
- [validador_v1.md](../prompts/validador_v1.md) — Auditoría Capa 1 ORM de privacidad (`< 5 ms`) y Capa 2 LLM de fidelidad (`T=0`, `max_tokens: 120`).
- [escalamiento_v1.md](../prompts/escalamiento_v1.md) — Generación correlativa de tickets (`TKT-YYYY-XXX`) en `tickets_rrhh` y flujo de resolución RRHH.

---

## 4. Extracción Multi-Formato, Chunking, Embeddings y Metadatos

### 4.1 Extracción Multi-Formato desde Google Drive (`drive.readonly`)

`documentParser.js` soporta los tres formatos oficiales presentes en la carpeta de Drive (`1EoC57BOpxEqWiiac5RGdrhCLu72RkLTn`):
1. **Google Docs** (`application/vnd.google-apps.document`): Exportación UTF-8 vía `drive.files.export(..., mimeType: 'text/plain')`.
2. **Google Sheets** (`application/vnd.google-apps.spreadsheet`): Exportación vía `drive.files.export(..., mimeType: 'text/csv')` transformando filas CSV en bloques legibles separados por `|` y saltos dobles antes de encabezados.
3. **PDF** (`application/pdf`): Descarga binaria (`alt: 'media'`) y extracción de texto mediante `pdf-parse`.

En todos los casos se normalizan saltos de línea y se extraen automáticamente desde la tabla de cabecera: `titulo`, `codigo_version` (priorizando patrones `XXX-RRHH-NN · vX.X`), `fecha_vigencia` y `responsable`, además de `fileId`, `fileName`, `mimeType`, `webViewLink` y `modifiedTime`.

### 4.2 Chunking Semántico y Hallazgo Crítico en Embeddings Locales

- **Chunking (`chunker.js`):** Divide cada documento en fragmentos de **~2,400–2,600 caracteres** (~600–800 tokens) con **~450 caracteres de solapamiento** (~120 tokens), sin cortar palabras y detectando tanto encabezados Markdown (`##` / `###`) como encabezados numerados de Google Docs/PDF (`3.1 ...`) para registrar la `seccion` exacta en los metadatos de cada chunk. Los 10 documentos generan **31 chunks** persistentes.
- **Hallazgo y solución técnica en `embeddingService.js`:** Durante las pruebas iniciales se observó que pasar un fragmento de ~2,500 caracteres en una sola llamada a `Xenova/paraphrase-multilingual-MiniLM-L12-v2` degradaba severamente la similitud coseno (`0.02–0.19`) debido a la ventana efectiva de contexto del modelo. Se implementó segmentación interna por **sub-ventanas deslizantes de 450 caracteres** (solapamiento de 100 caracteres) con promedio L2-normalizado de los vectores resultantes, elevando las coincidencias válidas a **`0.55–0.68`**.
- **Búsqueda Híbrida (`vectorStore.js` + `politicasAgent.js`):** Para evitar que encabezados corporativos repetidos desplazaran secciones específicas en consultas puntuales, `politicasAgent.js` resuelve dinámicamente términos relacionados por `tema_asociado` desde la tabla `palabras_clave` en MySQL (cero listas hardcodeadas en JS) y `searchSimilar` combina similitud coseno con refuerzo léxico normalizado. Este enfoque logró **0.9542** de relevancia de contexto y **0.9938** de fidelidad RAG.

---

## 5. Resultados Reales de Evaluación (Banco de 45 Preguntas)

El script automatizado [evaluateBenchmark.js](../../backend/tests/evaluateBenchmark.js) ejecutó las **45 preguntas reales** (25 base obligatorias + 20 propias del equipo) directamente sobre el endpoint `POST http://localhost:3000/api/chat` con autenticación JWT real (`carlos.solano@novacore.cr` y `laura.mendez@novacore.cr`). El detalle completo fila por fila consta en [hoja_evaluacion_45_preguntas.md](../evaluacion/hoja_evaluacion_45_preguntas.md).

### 5.1 Métricas Consolidadas

| Métrica | Valor Medido |
| :--- | :--- |
| **Total de preguntas ejecutadas** | **45** |
| **Preguntas aprobadas** | **43 / 45 (95.56 %)** *(meta ≥ 95 %)* |
| **Preguntas con observación parcial** | **2** (`#2`: respondió `Días disponibles: 11.00` sin la palabra `días`; `#7`: citó `PRO-RRHH-03` con `rel=0.85 / fid=0.95`, omitiendo expresar `100 %` / `40 %`) |
| **Latencia promedio global (incluyendo `validadorAgent`)** | **4,467 ms** (~4.47 s) |
| **Respuestas < 8,000 ms** | **43 / 45 (95.56 %)** *(meta ≥ 90 %; solo #19 con 8,785 ms y #37 con 8,242 ms)* |
| **Respuestas auditadas por `validadorAgent`** | **45 / 45 (100 %)** |
| **Relevancia de Contexto RAG (LLM-as-a-Judge, 24 políticas)** | **0.9542 / 1.00** |
| **Fidelidad de Respuesta RAG (LLM-as-a-Judge, 24 políticas)** | **0.9938 / 1.00** |
| **Fugas de privacidad (#21, #22, #39, #40)** | **0 fugas (100 % rechazo seguro)** |
| **Escalamiento sin alucinación (#23, #41, #42)** | **3 / 3 (`escalada: true`, 0 citas inventadas)** |
| **Redirección fuera de alcance (#24, #43)** | **2 / 2 (`fuera_alcance`)** |

### 5.2 Desempeño por Categoría de Pregunta

| Categoría | Cantidad | Aciertos | Latencia Promedio |
| :--- | :---: | :---: | :---: |
| **Política (RAG Drive + Validador)** | 24 | 23 / 24 (95.83 %) | ~5,142 ms |
| **Dato personal (MySQL ORM + Validador)** | 6 | 5 / 6 (83.33 %) | ~4,615 ms |
| **Mixta (MySQL + RAG + Validador)** | 3 | 3 / 3 (100 %) | ~8,313 ms |
| **Dato agregado RRHH (`rol: rrhh`)** | 3 | 3 / 3 (100 %) | ~4,606 ms |
| **Restringida (Guardrail Ley 8968 + BD)** | 4 | 4 / 4 (100 %) | ~585 ms |
| **Sin respuesta (Escalamiento RRHH)** | 3 | 3 / 3 (100 %) | ~2,935 ms |
| **Fuera de alcance (Guardrail + BD)** | 2 | 2 / 2 (100 %) | ~1 ms |

---

## 6. Limitaciones Actuales y Mejoras Futuras

### 6.1 Limitaciones Identificadas

1. **Vector Store en Archivo Local (`vectors.json`):** Ideal para decenas de documentos corporativos (~31–500 chunks), pero ante miles de documentos requerirá migrar `vectorStore.js` hacia un servicio ChromaDB dedicado (ya contemplado en `.env.example`) o `pgvector`/`Qdrant` para escalado horizontal.
2. **Latencia de Consultas Mixtas (~6.5–8.2 s):** Involucran tres rondas secuenciales/paralelas hacia DeepSeek (clasificación + subagentes + síntesis). Aunque es aceptable, ocasionalmente roza el umbral de 8 segundos.
3. **Historial de Chat en BD sin Cuerpo de Respuesta:** La tabla `consultas_chat` registra `pregunta`, `intencion`, `agente`, `documentos_citados`, `resuelta`, `escalada`, `latencia_ms` y `fecha` para analítica de RRHH, pero no almacena el texto completo de la respuesta histórica entre sesiones distintas del navegador.
4. **Cobertura de Tests Unitarios Aislados:** La verificación se centró en pruebas end-to-end reales y la batería de 45 preguntas; resta incorporar pruebas unitarias con *mocks* de LLM y Drive para CI/CD sin consumo de API externa.

### 6.2 Hoja de Ruta de Mejoras Futuras

- **Streaming SSE (Server-Sent Events):** Transmitir tokens en tiempo real desde DeepSeek hacia `ChatPage.jsx` para reducir la percepción de latencia en respuestas largas y mixtas.
- **Re-ranker Cross-Encoder / Búsqueda en ChromaDB:** Conectar el cliente `chromadb` ya instalado para escenarios multi-sucursal o cientos de anexos legales.
- **Aprobación de Vacaciones/Permisos desde el Portal:** Extender el flujo actual de tickets (`tickets_rrhh`) para permitir también la aprobación de solicitudes de vacaciones/permisos (`solicitudes`) directamente por la jefatura desde el portal.
- **Caché de Consultas Frecuentes:** Cachear respuestas normativas estáticas (ej. días de vacaciones, fecha de aguinaldo) reduciendo latencia a `< 200 ms` y minimizando costos de API.

