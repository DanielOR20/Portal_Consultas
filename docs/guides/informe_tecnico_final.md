# Informe Técnico Final — Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente

| Campo | Detalle |
| :--- | :--- |
| **Proyecto** | Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente (`Portal_Consultas`) |
| **Organización Modelo** | NovaCore Technologies Costa Rica S.A. (250 colaboradores · Sector Software B2B) |
| **Marco Normativo** | Legislación Laboral de la República de Costa Rica (Código de Trabajo Ley N.° 2 y leyes conexas) |
| **Versión / Fecha** | `v1.0` · 17 de noviembre de 2026 |
| **Repositorio Oficial** | `https://github.com/DanielOR20/Portal_Consultas.git` |

---

## 1. Resumen Ejecutivo y Arquitectura del Sistema

El **Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente** resuelve dos problemas críticos de operación en organizaciones tecnológicas de mediano tamaño como **NovaCore Technologies Costa Rica S.A.**:

1. **Autoservicio normativo y personal con trazabilidad verificable:** Permite a los colaboradores resolver dudas sobre políticas internas, legislación laboral costarricense y sus propios datos laborales (saldos de vacaciones, solicitudes, incapacidades, fechas de pago y evaluaciones) en segundos, citando exactamente el documento fuente, su código/versión, sección y enlace directo en Google Drive.
2. **Analítica operativa y detección de brechas para Talento Humano:** Genera de forma determinista y automatizada un reporte diario con 8 indicadores clave (ausentismo, atraso en aprobaciones, incapacidades CCSS/INS, rotación, riesgo de pasivo vacacional `> 20 días`, rendimiento del chatbot, brechas documentales y tendencia de 30 días), respaldado por un resumen ejecutivo redactado sin invención de cifras.

### 1.1 Desacoplamiento de Flujos

La arquitectura divide el sistema en dos planos independientes (detallados en [diagrama_arquitectura.md](../architecture/diagrama_arquitectura.md)):

- **Plano Síncrono (Tiempo Real):** Aplicación SPA en React + Vite comunicada vía REST/JWT con Express. El **Agente Orquestador** clasifica cada consulta y la enruta hacia el **Agente de Políticas RAG** (búsqueda híbrida sobre `vectors.json`), el **Agente de Datos del Colaborador** (consultas Sequelize de solo lectura en MySQL), ambos en paralelo (`Promise.all` para consultas mixtas), o un **Guardrail** inmediato para rechazar fugas de privacidad (`restringida`) y temas ajenos (`fuera_alcance`).
- **Plano Asíncrono / Programado (`node-cron`):**
  - **06:30 a.m. (`driveSyncJob.js`):** El **Agente de Ingesta** consulta Google Drive API v3 (`drive.changes` y listado de carpeta) para detectar altas, modificaciones y eliminaciones de documentos en Docs, Sheets y PDF, regenerando *chunks* y *embeddings* únicamente cuando existen cambios.
  - **07:00 a.m. (`dailyReportJob.js`):** El **Agente Analista** calcula determinísticamente en SQL/Sequelize los 8 KPIs diarios, solicita a DeepSeek un resumen ejecutivo de 3 a 5 frases basado exclusivamente en el JSON calculado y guarda el reporte en `reportes_diarios`.

---

## 2. Justificación del Stack Tecnológico

| Capa | Tecnología Elegida | Justificación Técnica y Operativa |
| :--- | :--- | :--- |
| **Backend API** | Node.js (CommonJS) + Express 4 | Ecosistema unificado en JavaScript entre frontend y backend, arranque ligero, compatibilidad directa con `sequelize-cli`, `pdf-parse` y `googleapis`, y manejo asíncrono eficiente para llamadas concurrentes en consultas mixtas. |
| **Base de Datos Relacional** | MySQL 8.0 + Sequelize ORM (`mysql2`) | Integridad referencial estricta entre las **8 tablas** del portal (`colaboradores`, `saldos_vacaciones`, `solicitudes`, `incapacidades`, `movimientos_personal`, `consultas_chat`, `reportes_diarios` y `palabras_clave`), migraciones versionadas reproducibles, gestión dinámica de **81 palabras clave** en BD sin listas hardcodeadas en JS y consultas **100 % vía Sequelize ORM (cero SQL crudo)** en toda la aplicación. |
| **Seguridad y Validación** | `jsonwebtoken` + `bcryptjs` + `zod` | Autenticación *stateless* con expiración configurable (`8h`), hashing seguro de contraseñas con salt y validación estructural estricta de entradas en endpoints críticos (`/api/auth/login`, `/api/chat`). |
| **Modelo de Lenguaje (LLM)** | DeepSeek API (`deepseek-chat`) vía SDK `openai` | Excelente relación costo/latencia y soporte nativo de `response_format: { type: 'json_object' }`, indispensable para clasificación determinista de intenciones (`T=0`) y respuestas estructuradas con verificación de cobertura documental (`T=0.1`). |
| **Embeddings Multilingües** | `@xenova/transformers` (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`) | DeepSeek no provee API de embeddings; este modelo ONNX local de 384 dimensiones optimizado para texto multilingüe (incluyendo español) opera sin dependencias externas en la nube, sin costo por token de indexación y con latencia ~30–50 ms por consulta tras su carga inicial. |
| **Almacenamiento Vectorial** | Vector Store JSON persistente (`backend/vector_store/vectors.json`) | Para una base normativa corporativa de 10 documentos oficiales (~31 fragmentos vectorizados de 384 dimensiones), un almacén persistente en memoria + disco con búsqueda híbrida (coseno + refuerzo léxico) ofrece latencia sub-milisegundo sin requerir levantar un contenedor Docker adicional para ChromaDB en desarrollo local, manteniendo compatibilidad arquitectónica con una futura migración a base vectorial distribuida. |
| **Frontend & Visualización** | React 18 + Vite 6 + Tailwind CSS v4 + Chart.js | Compilación rápida (`5.22s`), sistema de diseño corporativo luminoso en **Vino y Blanco** (`#722F37`, `#4E1A21`, `#FDF2F4`, `#FFFFFF`, `#FAF7F8`) con notificaciones Toast, barra de progreso vacacional, explorador de preguntas por categoría y gráficos interactivos (`Line`, `Bar`, `Doughnut`) mediante `react-chartjs-2`. |

---

## 3. Diseño Multiagente, Control de Acceso por Roles (RBAC) y Prompts Versionados

### 3.1 Los 5 Agentes Especializados

1. **`ingestaAgent.js` (Agente de Ingesta):** Mantiene sincronizado el índice vectorial con la carpeta oficial de Google Drive mediante `sync_state.json` y `drive.changes.getStartPageToken` / `changes.list`, asegurando eliminación de vectores huérfanos cuando un documento es borrado o movido.
2. **`orquestadorAgent.js` (Agente Orquestador):** Clasifica la consulta en exactamente una de 5 intenciones (`politica`, `dato_personal`, `mixta`, `restringida`, `fuera_alcance`), aplica guardrails tempranos, ejecuta paralelismo con `Promise.all` en consultas mixtas y persiste trazabilidad completa en `consultas_chat` (`colaborador_id`, `pregunta`, `intencion`, `agente`, `documentos_citados`, `resuelta`, `escalada`, `latencia_ms`, `fecha`).
3. **`politicasAgent.js` (Agente de Políticas RAG):** Ejecuta recuperación híbrida (`topK = 7`, `minScore = 0.38`) y obliga al LLM a responder en `jsonMode` indicando `"encontrada": true | false` y `"indices_usados"`. Si no hay evidencia documental suficiente o la consulta trata sobre beneficios inexistentes (ej. bono por mascotas, vehículos eléctricos o hipotecas directas), devuelve `escalada: true` sin inventar información.
4. **`datosAgent.js` (Agente de Datos del Colaborador):** Consulta MySQL en modo solo lectura filtrando por `colaborador_id = req.user.id`. Ejecuta en JavaScript determinista el cálculo de próxima quincena hábil (día 15 o último día hábil) y próxima evaluación semestral (junio/diciembre o fin de periodo de prueba de 90 días).
5. **`analistaAgent.js` (Agente Analista de Reportes):** Calcula los 8 indicadores diarios exclusivamente mediante consultas ORM agregadas y utiliza DeepSeek (`T=0.2`) únicamente para redactar la síntesis ejecutiva de 3 a 5 frases a partir de ese JSON cerrado.

### 3.2 Control de Acceso por Roles (RBAC) y Protección de Privacidad

El sistema implementa defensa en profundidad en cuatro niveles:

| Nivel | Mecanismo Implementado | Garantía |
| :--- | :--- | :--- |
| **1. Autenticación HTTP** | `authMiddleware.js` verifica JWT Bearer y adjunta `{ id, email, nombre, departamento, rol }` desde el token firmado. | Bloquea cualquier petición anónima (`401 Unauthorized`). |
| **2. Autorización por Ruta** | `roleMiddleware.js` (`requireRole('rrhh')`) protege `POST /api/ingest/sync`, `GET /api/dashboard/latest`, `GET /api/dashboard/history` y `POST /api/dashboard/generate`. | Un `colaborador` recibe `403 Forbidden` en endpoints administrativos y es redirigido en frontend por `ProtectedRoute.jsx`. |
| **3. Guardrail Semántico** | El Orquestador clasifica preguntas sobre terceros o salarios individuales como `restringida` (y consultas globales de personal si `rol !== 'rrhh'`) rechazando en ~1 s con cita a la **Ley N.° 8968**. | **0 fugas** sin siquiera consultar tablas de terceros ni invocar subagentes. |
| **4. Aislamiento en Capa ORM** | `datosAgent.js` filtra todas las consultas personales con `where: { colaborador_id: user.id }`. Solo desbloquea conteos agregados (`COUNT` sin salarios) cuando `user.rol === 'rrhh'`. | Imposibilidad estructural de exponer datos de otros colaboradores aunque el clasificador fallara. |

### 3.3 Gobernanza de Prompts Versionados (`docs/prompts/`)

Los cuatro prompts de sistema se mantienen documentados y versionados en `v1.0`:
- [orquestador_v1.md](../prompts/orquestador_v1.md) — Clasificación en 5 categorías (`T=0`, `jsonMode`) y síntesis mixta (`T=0.1`).
- [politicas_rag_v1.md](../prompts/politicas_rag_v1.md) — Grounding estricto en fragmentos recuperados, citas obligatorias y escalamiento ante ausencia documental (`T=0.1`, `jsonMode`).
- [datos_colaborador_v1.md](../prompts/datos_colaborador_v1.md) — Respuesta estricta sobre contexto JSON de MySQL (`T=0.1`).
- [analista_reportes_v1.md](../prompts/analista_reportes_v1.md) — Síntesis ejecutiva de 3 a 5 frases sin alteración de cifras SQL (`T=0.2`).

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
- **Búsqueda Híbrida (`vectorStore.js`):** Para evitar que encabezados corporativos repetidos desplazaran secciones específicas en consultas puntuales (ej. `fallecimiento`, `teletrabajo`, `accidente laboral` o `preaviso 8 meses`), `searchSimilar` combina la similitud coseno con un refuerzo léxico normalizado sin tildes y un diccionario compacto de sinónimos laborales en español (ej. `casa → teletrabajo`, `casar → matrimonio`, `accidente → riesgos/INS`). Este ajuste elevó la precisión del benchmark del **82.22 %** inicial al **100 %**.

---

## 5. Resultados Reales de Evaluación (Banco de 45 Preguntas)

El script automatizado [evaluateBenchmark.js](../../backend/tests/evaluateBenchmark.js) ejecutó las **45 preguntas reales** (25 base obligatorias + 20 propias del equipo) directamente sobre el endpoint `POST http://localhost:3000/api/chat` con autenticación JWT real (`carlos.solano@novacore.cr` y `laura.mendez@novacore.cr`). El detalle completo fila por fila consta en [hoja_evaluacion_45_preguntas.md](../evaluacion/hoja_evaluacion_45_preguntas.md).

### 5.1 Métricas Consolidadas

| Métrica | Valor Medido |
| :--- | :--- |
| **Total de preguntas ejecutadas** | **45** |
| **Preguntas aprobadas** | **44 / 45 (97.78 %)** *(meta ≥ 80 %)* |
| **Preguntas con observación parcial** | **1** (`#7`: citó `PRO-RRHH-03`, omitió detallar el `40 %` del complemento patronal días 4–30 en esa síntesis) |
| **Latencia promedio global** | **3,025 ms** (~3.03 s) |
| **Respuestas < 8,000 ms** | **45 / 45 (100 %)** *(meta ≥ 90 %)* |
| **Fugas de privacidad (#21, #22, #39, #40)** | **0 fugas (100 % rechazo seguro)** |
| **Escalamiento sin alucinación (#23, #41, #42)** | **3 / 3 (`escalada: true`, 0 citas inventadas)** |
| **Redirección fuera de alcance (#24, #43)** | **2 / 2 (`fuera_alcance`)** |

### 5.2 Desempeño por Categoría de Pregunta

| Categoría | Cantidad | Aciertos | Latencia Promedio |
| :--- | :---: | :---: | :---: |
| **Política (RAG Drive)** | 24 | 23 / 24 (95.83 %) | ~3,332 ms |
| **Dato personal (MySQL ORM)** | 6 | 6 / 6 (100 %) | ~2,777 ms |
| **Mixta (MySQL + RAG paralelo)** | 3 | 3 / 3 (100 %) | ~6,678 ms |
| **Dato agregado RRHH (`rol: rrhh`)** | 3 | 3 / 3 (100 %) | ~2,866 ms |
| **Restringida (Guardrail Ley 8968 + BD)** | 4 | 4 / 4 (100 %) | ~547 ms |
| **Sin respuesta (Escalamiento RRHH)** | 3 | 3 / 3 (100 %) | ~2,386 ms |
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
- **Flujo de Aprobación y Ticketización desde el Portal:** Permitir que las solicitudes escaladas (`escalada: true`) creen automáticamente un ticket asignado a un especialista de Talento Humano y que jefaturas aprueben solicitudes pendientes desde el portal.
- **Caché de Consultas Frecuentes:** Cachear respuestas normativas estáticas (ej. días de vacaciones, fecha de aguinaldo) reduciendo latencia a `< 200 ms` y minimizando costos de API.

