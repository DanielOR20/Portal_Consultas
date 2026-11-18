# Diagrama de Arquitectura del Sistema Multiagente RAG

| Campo | Detalle |
| :--- | :--- |
| **Proyecto** | Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente |
| **Empresa Modelo** | NovaCore Technologies Costa Rica S.A. |
| **Versión** | `v1.3` (9 tablas MySQL · 7 Agentes · 100 % Sequelize ORM · UI Vino Fosforescente & Blanco) |
| **Fecha** | 18 de noviembre de 2026 |

---

## 1. Visión General de Flujos Independientes

La arquitectura del portal separa estrictamente la **ruta interactiva en tiempo real** (consultas conversacionales con voz, validación de fidelidad/privacidad y creación de tickets) de los **flujos batch programados** (sincronización con Google Drive cada hora y `07:00 a.m.` generación del reporte analítico diario). Toda la persistencia relacional —incluyendo las **9 tablas** en MySQL y la gestión dinámica de `palabras_clave` y `tickets_rrhh`— opera exclusivamente mediante **Sequelize ORM (cero SQL crudo)**.

---

## 2. Flujo 1: Conversacional en Tiempo Real (Chat Multiagente + Validador + Tickets)

```mermaid
flowchart TD
    U["Usuario (Colaborador / RRHH)<br/>React + Vite (Vino Fosforescente & Blanco)<br/>Web Speech API (Voz STT / TTS)"] -->|"HTTPS / JSON + Bearer JWT"| API["API Gateway Express<br/>authMiddleware + roleMiddleware"]
    API -->|"POST /api/chat<br/>{ pregunta, historial }"| ORQ["1. Agente Orquestador<br/>(orquestadorAgent.js)<br/>DeepSeek jsonMode · T=0"]

    KW[("MySQL · Tabla palabras_clave<br/>Sequelize ORM + caché 60 s<br/>(CRUD + invalidación inmediata)")] -->|"restringida / fuera_alcance /<br/>politica / dato_personal"| ORQ

    ORQ -->|"intencion = restringida"| G1["Guardrail Privacidad<br/>Ley N.° 8968 (0 fugas)"]
    ORQ -->|"intencion = fuera_alcance"| G2["Guardrail Ámbito RRHH<br/>Redirección amable"]
    ORQ -->|"intencion = politica"| POL["2. Agente de Políticas RAG<br/>(politicasAgent.js)"]
    ORQ -->|"intencion = dato_personal"| DAT["3. Agente de Datos Personales<br/>(datosAgent.js)"]
    ORQ -->|"intencion = mixta<br/>(Promise.all paralelo)"| MIX["Ejecución Paralela<br/>Datos + Políticas + Síntesis"]

    KW -->|"Expansión temática por tema_asociado"| POL
    POL -->|"Embedding local MiniLM-L12-v2<br/>+ búsqueda híbrida"| VEC[("Vector Store Local<br/>vectors.json · 31 chunks<br/>Umbral híbrido >= 0.38")]
    VEC -->|"Top-7 fragmentos + metadatos"| POL
    POL -->|"Sin evidencia (escalada = true)"| ESC["4. Agente de Escalamiento<br/>(escalamientoAgent.js)<br/>POST /api/tickets -> TKT-2026-XXX"]
    ESC --> TKT[("MySQL · Tabla tickets_rrhh<br/>Sequelize ORM")]

    DAT -->|"Sequelize ORM solo lectura<br/>WHERE colaborador_id = req.user.id"| MYSQL[("MySQL portal_rrhh_db<br/>9 tablas · Sequelize ORM")]
    MIX --> POL
    MIX --> DAT

    POL --> VAL["5. Agente Validador<br/>(validadorAgent.js)<br/>Capa 1 ORM privacidad (<5ms)<br/>Capa 2 LLM fidelidad (T=0, <=120 tok)"]
    DAT --> VAL
    MIX --> VAL
    G1 --> LOG["Registro en consultas_chat<br/>(intención, agente, citas, latencia_ms)"]
    G2 --> LOG
    VAL -->|"validado: true"| LOG
    LOG -->|"Respuesta + Citas Drive + Validado"| U
```

---

## 3. Flujo 2: Ingesta Incremental (`cada hora`) y Reporte Analítico Diario (`07:00 a.m.`)

```mermaid
flowchart LR
    subgraph INGESTA["Flujo Batch A · Agente de Ingesta (cada hora / Manual RRHH)"]
        direction TB
        CRON1["Cron Job cada hora<br/>(driveSyncJob.js)"] --> ING["6. Agente de Ingesta<br/>(ingestaAgent.js)"]
        MAN1["POST /api/ingest/sync<br/>(Solo rol rrhh)"] --> ING
        ING -->|"Drive API v3 (drive.readonly)<br/>changes.list + files.list"| GDRIVE[("Google Drive Folder<br/>Docs · Sheets · PDF")]
        GDRIVE -->|"Export text/plain, text/csv<br/>y pdf-parse"| PARSE["Parser + Chunker<br/>600-800 tokens + metadatos"]
        PARSE -->|"Xenova/paraphrase-multilingual<br/>sub-windows 450 chars"| VSTORE[("backend/vector_store/<br/>vectors.json + sync_state.json")]
    end

    subgraph ANALITICA["Flujo Batch B · Agente Analista y Gestión RRHH (07:00 a.m.)"]
        direction TB
        CRON2["Cron Job 07:00 a.m.<br/>(dailyReportJob.js)"] --> ANA["7. Agente Analista<br/>(analistaAgent.js)"]
        MAN2["POST /api/dashboard/generate<br/>(Solo rol rrhh)"] --> ANA
        ANA -->|"Consultas Sequelize ORM deterministas<br/>+ palabras_clave (tema_dashboard)"| DB[("MySQL portal_rrhh_db<br/>9 tablas · Sequelize ORM")]
        DB -->|"datos_json (8 indicadores)"| LLM["DeepSeek API (T=0.2)<br/>Resumen Ejecutivo 3-5 frases"]
        LLM -->|"Upsert diario (ORM)"| REP[("Tabla reportes_diarios<br/>fecha única + datos_json + resumen")]
        REP -->|"GET /api/dashboard/latest & history<br/>+ Export CSV/JSON"| DASH["Dashboard RRHH (Vino Fosforescente)<br/>KPIs + Chart.js + 3 Pestañas:<br/>Solicitudes, Tickets y CRUD palabras_clave"]
        DB -->|"/api/tickets + /api/dashboard/keywords"| DASH
    end
```

---

## 4. Descripción por Capas y Control de Acceso (RBAC)

1. **Capa de Presentación (`frontend/`):** SPA React + Vite en estética corporativa **Vino Fosforescente y Blanco Puro** (`#E6004C`, `#FF1764`, `#FFF0F5`, `#FFFFFF`, `#F8F9FB`), con dictado/lectura por voz (Web Speech API), notificaciones Toast, tickets en vivo en `/chat` y `/dashboard`, panel inferior organizado en 3 pestañas con gestor visual CRUD de `palabras_clave` y exportación CSV/JSON.
2. **Capa API y Seguridad (`backend/src/routes`, `middlewares`, `controllers`):** Express con validación `zod`, hashing `bcryptjs`, JWT (`authMiddleware.js`) y RBAC (`roleMiddleware.js`).
   - Públicas: `GET /api/health`, `POST /api/auth/login`.
   - Autenticadas: `GET /api/auth/me`, `POST /api/chat`, `GET /api/chat/history`, `GET /api/ingest/status`, `POST /api/tickets`, `GET /api/tickets/mine`.
   - Exclusivas `rrhh`: `POST /api/ingest/sync`, `GET /api/dashboard/latest`, `GET /api/dashboard/history`, `POST /api/dashboard/generate`, `GET/POST/PATCH/DELETE /api/dashboard/keywords`, `GET /api/tickets`, `PATCH /api/tickets/:id/resolve`.
3. **Capa Multiagente (`backend/src/agents` — 7 agentes):** `orquestadorAgent`, `politicasAgent`, `datosAgent`, `validadorAgent`, `escalamientoAgent`, `ingestaAgent`, `analistaAgent`.
4. **Capa de Datos (`backend/src/models`, `migrations`, `seeders`, `rag`):** **9 tablas** en MySQL (`colaboradores`, `saldos_vacaciones`, `solicitudes`, `incapacidades`, `movimientos_personal`, `consultas_chat`, `reportes_diarios`, `palabras_clave`, `tickets_rrhh`) gobernadas al **100 % con Sequelize ORM**.
