# Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente

Plataforma interna de Recursos Humanos diseñada para **NovaCore Technologies Costa Rica S.A.** (empresa ficticia de desarrollo de software y servicios B2B con 250 colaboradores), construida bajo la legislación laboral vigente de la **República de Costa Rica** (Código de Trabajo Ley N.° 2, Ley N.° 7983, Ley N.° 10211, Ley N.° 7476, Ley N.° 8968, Ley N.° 9738 y reglamentos de CCSS e INS).

El sistema combina **orquestación de 7 agentes especializados** (Orquestador, Políticas RAG, Datos Personales, Validador, Escalamiento, Ingesta y Analista), **RAG** conectado a **Google Drive API**, **9 tablas en MySQL** gestionadas 100 % con **Sequelize ORM (cero SQL crudo)**, control estricto de acceso por roles (**RBAC**: `colaborador` vs `rrhh`) y un **Dashboard Analítico y de Tickets** en diseño **Vino y Blanco** con interacción por voz.

---

## Tecnologías Principales

- **Frontend:** React 18, Vite 6, Tailwind CSS v4 (paleta corporativa Vino y Blanco), React Router, Axios, Chart.js (`react-chartjs-2`), Lucide Icons, Web Speech API (reconocimiento y síntesis de voz en `es-CR`)
- **Backend:** Node.js (CommonJS), Express, Sequelize ORM (9 tablas, **100 % sin SQL crudo**), MySQL (`mysql2`), JWT (`jsonwebtoken`), `bcryptjs`, `zod`, `node-cron`
- **IA, RAG y Documentos:**
  - **LLM:** DeepSeek API (`deepseek-chat` vía SDK oficial `openai`)
  - **Embeddings locales multilingües:** `@xenova/transformers` (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, *sub-windows* de 450 caracteres para alta precisión semántica en español)
  - **Vector Store persistente:** `backend/vector_store/vectors.json` + estado incremental `sync_state.json`
  - **Fuente documental:** Google Drive API v3 (`drive.readonly`) con soporte para **Google Docs**, **Google Sheets** y **PDF** (`pdf-parse`)

---

## Arquitectura General

El sistema opera con dos flujos desacoplados (ver [diagrama_arquitectura.md](docs/architecture/diagrama_arquitectura.md)):

1. **Flujo Conversacional en Tiempo Real (`/api/chat`):**
   - **Agente Orquestador (`orquestadorAgent.js`):** Carga palabras clave activas desde MySQL (`palabras_clave`, 81 registros sin hardcoding en JS), clasifica la consulta en `politica`, `dato_personal`, `mixta`, `restringida` o `fuera_alcance`, aplica guardrails de privacidad (Ley N.° 8968) y registra cada interacción en `consultas_chat`.
   - **Agente de Políticas RAG (`politicasAgent.js`):** Recupera fragmentos de políticas mediante búsqueda híbrida (`minScore = 0.38`, expansión temática desde `palabras_clave`) y responde citando título, código/versión, sección y enlace a Drive; si no hay respaldo documental, escala el caso (`escalada: true`).
   - **Agente de Datos del Colaborador (`datosAgent.js`):** Consulta MySQL vía Sequelize ORM en solo lectura filtrando por `colaborador_id = req.user.id` (y agregados globales únicamente si `rol === 'rrhh'`).
   - **Agente Validador (`validadorAgent.js`):** Audita cada respuesta antes de entregarla mediante Capa 1 determinista ORM (prevención de fugas de terceros) y Capa 2 LLM rápida de fidelidad (`validado: true`).
   - **Agente de Escalamiento (`escalamientoAgent.js`):** Crea tickets formales con folio correlativo (`TKT-2026-XXX`) en `tickets_rrhh` cuando no existe política vigente o el colaborador solicita atención humana.
2. **Flujos Programados (`node-cron`):**
   - **Agente de Ingesta (`06:30 a.m.` · `ingestaAgent.js`):** Sincronización incremental vía `drive.changes` y verificación de carpeta (`Docs`, `Sheets`, `PDF`).
   - **Agente Analista (`07:00 a.m.` · `analistaAgent.js`):** Calcula 8 KPIs deterministas vía Sequelize ORM (clasificando el Top 5 de temas desde `palabras_clave`), redacta un resumen ejecutivo con DeepSeek y persiste en `reportes_diarios`.

---

## Estructura del Repositorio

```text
.
├── .env.example                           # Plantilla global de variables de entorno
├── .gitignore                             # Excluye .env, credentials/, node_modules/, dist/, vector_store/
├── README.md                              # Documentación principal del proyecto
├── backend/                               # API Express, Sequelize, RAG y Agentes
│   ├── .sequelizerc
│   ├── package.json
│   ├── src/
│   │   ├── agents/                        # 7 agentes (ingesta, politicas, datos, orquestador, validador, escalamiento, analista)
│   │   ├── config/                        # database.js y llmClient.js (DeepSeek)
│   │   ├── controllers/                   # authController, chatController, dashboardController, ingestController, ticketController
│   │   ├── jobs/                          # driveSyncJob.js (06:30) y dailyReportJob.js (07:00)
│   │   ├── middlewares/                   # authMiddleware.js (JWT) y roleMiddleware.js (RBAC)
│   │   ├── migrations/                    # 9 migraciones SQL (incluye palabras_clave y tickets_rrhh)
│   │   ├── models/                        # 9 modelos Sequelize con asociaciones
│   │   ├── rag/                           # driveClient, documentParser, chunker, embeddingService, vectorStore
│   │   ├── routes/                        # authRoutes, chatRoutes, dashboardRoutes, ingestRoutes, ticketRoutes
│   │   ├── seeders/                       # 55 colaboradores + historial + 81 palabras_clave + 3 tickets (100% ORM)
│   │   ├── utils/                         # jsonHelper.js
│   │   ├── app.js
│   │   └── server.js
│   └── tests/
│       └── evaluateBenchmark.js           # Evaluación automatizada de 45 preguntas
├── docs/
│   ├── architecture/
│   │   └── diagrama_arquitectura.md       # Diagramas Mermaid del sistema
│   ├── evaluacion/
│   │   └── hoja_evaluacion_45_preguntas.md# Resultados oficiales del banco de pruebas
│   ├── guides/
│   │   ├── informe_investigacion_rrhh.md  # Marco legal de Costa Rica (10 dominios)
│   │   ├── informe_tecnico_final.md       # Informe técnico completo
│   │   └── guion_demo_5min.md             # Guion de demostración de 5 minutos
│   ├── knowledge-base/                    # 10 documentos oficiales de políticas en Markdown
│   └── prompts/                           # Prompts versionados v1.0 de los agentes
└── frontend/                              # SPA React + Vite + Tailwind CSS + Chart.js
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── components/                    # Navbar, ProtectedRoute, Toast
        ├── context/                       # AuthContext, ToastContext
        ├── hooks/                         # useAuth
        ├── pages/                         # LoginPage, ChatPage, DashboardPage
        ├── services/                      # api.js (Axios + interceptores JWT)
        ├── styles/                        # index.css (Diseño Vino y Blanco)
        └── utils/                         # formatters.jsx
```

---

## Instalación y Configuración

### Prerrequisitos
- **Node.js** `v20+` (probado en `v24.18.0`)
- **MySQL** `8.0+` ejecutándose localmente en `127.0.0.1:3306`
- **Credenciales:**
  - API Key de **DeepSeek** (`LLM_API_KEY`)
  - Archivo JSON de **Google Service Account** con acceso de solo lectura a la carpeta de políticas en Google Drive (`backend/credentials/service-account.json`, nunca versionado)

### 1. Instalar dependencias

```powershell
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configurar variables de entorno

#### Backend (`backend/.env`)
Crea `backend/.env` tomando como base `.env.example` (nunca subas este archivo a Git):

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

JWT_SECRET=tu_secreto_jwt_seguro
JWT_EXPIRES_IN=8h

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=portal_rrhh_db
DB_USER=root
DB_PASSWORD=tu_password_mysql

GOOGLE_DRIVE_FOLDER_ID=id_carpeta_google_drive
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json

LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=tu_deepseek_api_key
LLM_MODEL=deepseek-chat
```

#### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 3. Crear Base de Datos, Migraciones y Seeder

Asegúrate de que exista la base de datos `portal_rrhh_db` en MySQL (`utf8mb4` / `utf8mb4_unicode_ci`), luego ejecuta desde `backend/`:

```powershell
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

Esto crea las **9 tablas** (`colaboradores`, `saldos_vacaciones`, `solicitudes`, `incapacidades`, `movimientos_personal`, `consultas_chat`, `reportes_diarios`, `palabras_clave`, `tickets_rrhh`) y pobla **55 colaboradores ficticios** (52 `colaborador`, 3 `rrhh`), saldos de vacaciones, solicitudes, incapacidades, movimientos de personal, consultas de historial, **81 palabras clave** dinámicas y **3 tickets RRHH** de ejemplo.

### 4. Arrancar el Proyecto (Desarrollo)

En dos terminales separadas:

```powershell
# Terminal 1: Backend (puerto 3000)
cd backend
npm run dev
```

```powershell
# Terminal 2: Frontend (puerto 5173)
cd frontend
npm run dev
```

Abre **`http://localhost:5173`** en tu navegador.

### 5. Sincronizar Documentos de Google Drive y Generar Reporte Inicial

1. Inicia sesión con la cuenta de demostración **`rrhh`**:
   - **Correo:** `laura.mendez@novacore.cr`
   - **Contraseña:** `NovaCore2026!`
2. Ve a **Dashboard RRHH** (`/dashboard`) y haz clic en **"Sincronizar Drive"** (o llama a `POST /api/ingest/sync`). El sistema descargará los 10 documentos, extraerá metadatos, fragmentará en chunks y generará `backend/vector_store/vectors.json`.
3. Al ingresar a `/dashboard`, si aún no existe reporte del día en `reportes_diarios`, el sistema lo genera automáticamente (o puedes regenerarlo con **"Regenerar Reporte"**).

### 6. Credenciales de Prueba

| Rol | Correo | Contraseña | Vistas habilitadas |
| :--- | :--- | :--- | :--- |
| **`colaborador`** | `carlos.solano@novacore.cr` | `NovaCore2026!` | `/chat` (Asistente Virtual + datos propios) |
| **`rrhh`** | `laura.mendez@novacore.cr` | `NovaCore2026!` | `/chat` + `/dashboard` (Analítica RRHH + Sync Drive) |

### 7. Ejecutar Banco de Evaluación (45 Preguntas)

Con el backend activo en el puerto `3000`:

```powershell
node backend/tests/evaluateBenchmark.js
```
