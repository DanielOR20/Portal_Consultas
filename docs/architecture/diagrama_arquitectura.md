# Diagrama de Arquitectura del Sistema Multiagente RAG

| Campo | Detalle |
| :--- | :--- |
| **Proyecto** | Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente |
| **Empresa Modelo** | NovaCore Technologies Costa Rica S.A. |
| **Versión** | `v1.1` (8 tablas MySQL · 100 % Sequelize ORM) |
| **Fecha** | 17 de noviembre de 2026 |

---

## 1. Visión General de Flujos Independientes

La arquitectura del portal separa estrictamente la **ruta interactiva en tiempo real** (consultas conversacionales de colaboradores y personal de RRHH) de los **flujos batch programados** (sincronización incremental con Google Drive a las `06:30 a.m.` y generación del reporte ejecutivo diario a las `07:00 a.m.`). Toda la persistencia relacional y la gestión dinámica de palabras clave (`palabras_clave`) operan exclusivamente mediante **Sequelize ORM (cero SQL crudo)**.

---

## 2. Flujo 1: Conversacional en Tiempo Real (Chat Multiagente)

```mermaid
flowchart TD
    U["Usuario (Colaborador / RRHH)<br/>React + Vite (Dark Mode)"] -->|"HTTPS / JSON + Bearer JWT"| API["API Gateway Express<br/>authMiddleware + roleMiddleware"]
    API -->|"POST /api/chat<br/>{ pregunta, historial }"| ORQ["Agente Orquestador<br/>(orquestadorAgent.js)<br/>DeepSeek jsonMode · T=0"]

    KW[("MySQL · Tabla palabras_clave<br/>79 registros dinámicos vía Sequelize ORM<br/>(caché en memoria 60 s)")] -->|"restringida / fuera_alcance /<br/>politica / dato_personal"| ORQ

    ORQ -->|"intencion = restringida"| G1["Guardrail Privacidad<br/>Ley N.° 8968 (0 fugas)"]
    ORQ -->|"intencion = fuera_alcance"| G2["Guardrail Ámbito RRHH<br/>Redirección amable"]
    ORQ -->|"intencion = politica"| POL["Agente de Políticas RAG<br/>(politicasAgent.js)"]
    ORQ -->|"intencion = dato_personal"| DAT["Agente de Datos Personales<br/>(datosAgent.js)"]
    ORQ -->|"intencion = mixta<br/>(Promise.all paralelo)"| MIX["Ejecución Paralela<br/>Datos + Políticas + Síntesis"]

    KW -->|"Expansión temática por tema_asociado"| POL
    POL -->|"Embedding local MiniLM-L12-v2<br/>+ búsqueda híbrida"| VEC[("Vector Store Local<br/>vectors.json · 31 chunks<br/>Umbral híbrido >= 0.38")]
    VEC -->|"Top-7 fragmentos + metadatos"| POL
    POL -->|"Sin evidencia o no cubierto"| ESC["Escalamiento RRHH<br/>(escalada = true)"]

    DAT -->|"Sequelize ORM solo lectura<br/>WHERE colaborador_id = req.user.id<br/>(Agregados solo si rol = 'rrhh')"| MYSQL[("MySQL portal_rrhh_db<br/>8 tablas · Sequelize ORM")]
    MIX --> POL
    MIX --> DAT

    G1 --> LOG["Registro Obligatorio (Sequelize ORM)<br/>Tabla consultas_chat<br/>(intención, agente, citas, latencia_ms)"]
    G2 --> LOG
    POL --> LOG
    ESC --> LOG
    DAT --> LOG
    MIX --> LOG
    LOG -->|"Respuesta + Citas Drive + Badges"| U
```

---

## 3. Flujo 2: Ingesta Incremental (`06:30 a.m.`) y Reporte Analítico Diario (`07:00 a.m.`)

```mermaid
flowchart LR
    subgraph INGESTA["Flujo Batch A · Ingesta Incremental (06:30 a.m. / Manual RRHH)"]
        direction TB
        CRON1["Cron Job 06:30 a.m.<br/>(driveSyncJob.js)"] --> ING["Agente de Ingesta<br/>(ingestaAgent.js)"]
        MAN1["POST /api/ingest/sync<br/>(Solo rol rrhh)"] --> ING
        ING -->|"Drive API v3 (drive.readonly)<br/>changes.list + files.list"| GDRIVE[("Google Drive Folder<br/>Docs · Sheets · PDF")]
        GDRIVE -->|"Export text/plain, text/csv<br/>y pdf-parse"| PARSE["Parser + Chunker<br/>600-800 tokens + metadatos"]
        PARSE -->|"Xenova/paraphrase-multilingual<br/>sub-windows 450 chars"| VSTORE[("backend/vector_store/<br/>vectors.json + sync_state.json")]
    end

    subgraph ANALITICA["Flujo Batch B · Reporte Analítico Diario (07:00 a.m. / Manual RRHH)"]
        direction TB
        CRON2["Cron Job 07:00 a.m.<br/>(dailyReportJob.js)"] --> ANA["Agente Analista<br/>(analistaAgent.js)"]
        MAN2["POST /api/dashboard/generate<br/>(Solo rol rrhh)"] --> ANA
        ANA -->|"Consultas Sequelize ORM deterministas<br/>+ palabras_clave (tema_dashboard)"| DB[("MySQL portal_rrhh_db<br/>8 tablas · Sequelize ORM")]
        DB -->|"datos_json (8 indicadores)"| LLM["DeepSeek API (T=0.2)<br/>Resumen Ejecutivo 3-5 frases"]
        LLM -->|"Upsert diario (ORM)"| REP[("Tabla reportes_diarios<br/>fecha única + datos_json + resumen")]
        REP -->|"GET /api/dashboard/latest & history<br/>+ GET /api/dashboard/keywords"| DASH["Dashboard RRHH<br/>React + Chart.js (KPIs + Gráficos)"]
    end
```

---

## 4. Descripción por Capas y Control de Acceso (RBAC)

1. **Capa de Presentación (`frontend/`):** SPA React + Vite en modo oscuro corporativo (`#0B1120` / `#111827`) con acentos esmeralda (`#10B981`). `ProtectedRoute.jsx` y `Navbar.jsx` ocultan y bloquean `/dashboard` para usuarios sin `rol === 'rrhh'`.
2. **Capa API y Seguridad (`backend/src/routes`, `middlewares`, `controllers`):** Express con validación `zod`, hashing `bcryptjs`, tokens JWT de `8h` (`authMiddleware.js`) y verificación de rol (`roleMiddleware.js`).
   - Rutas públicas: `GET /api/health`, `POST /api/auth/login`.
   - Rutas autenticadas: `GET /api/auth/me`, `POST /api/chat`, `GET /api/chat/history`, `GET /api/ingest/status`.
   - Rutas exclusivas `rrhh`: `POST /api/ingest/sync`, `GET /api/dashboard/latest`, `GET /api/dashboard/history`, `POST /api/dashboard/generate`, `GET /api/dashboard/keywords`.
3. **Capa Multiagente (`backend/src/agents`):** Cinco agentes especializados coordinados sin listas de palabras clave hardcodeadas en JS; todas las reglas léxicas y temáticas se leen desde la tabla `palabras_clave` mediante Sequelize ORM.
4. **Capa de Datos (`backend/src/models`, `migrations`, `seeders`, `rag`):** 8 tablas en MySQL gestionadas 100 % por Sequelize ORM (`colaboradores`, `saldos_vacaciones`, `solicitudes`, `incapacidades`, `movimientos_personal`, `consultas_chat`, `reportes_diarios`, `palabras_clave`) más el almacén vectorial local persistente en `backend/vector_store/vectors.json`.
