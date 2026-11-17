# Portal Interno de RRHH Multiagente con RAG

Plataforma interna de Recursos Humanos diseñada para asistir a colaboradores y al equipo de RRHH mediante una arquitectura **multiagente** combinada con **RAG (Retrieval-Augmented Generation)**. El sistema permite responder consultas sobre políticas internas, onboarding, beneficios y procedimientos organizacionales apoyándose en la documentación oficial de la empresa, además de canalizar solicitudes operativas hacia agentes especializados.

> **Estado del proyecto:** Fase inicial de estructura del repositorio. Sin dependencias instaladas ni funcionalidades implementadas todavía.

---

## Tecnologías principales

- **Frontend:** React + Vite
- **Backend:** Node.js (API REST y capa de orquestación)
- **Arquitectura de IA:** Sistema Multiagente + Pipeline RAG (ingesta de documentos, generación de embeddings, recuperación semántica y generación de respuestas fundamentadas)
- **Documentación y Base de Conocimiento:** Markdown / documentos fuente en `docs/`

---

## Arquitectura general

```text
+-------------------------------------------------------------------+
|                     Frontend (React + Vite)                       |
|   Interfaz conversacional, portal de autoservicio y consultas     |
+---------------------------------+---------------------------------+
                                  | HTTP / REST (JSON)
                                  v
+-------------------------------------------------------------------+
|                        Backend (Node.js)                          |
|  Routes -> Controllers -> Services -> Middlewares                 |
+---------------------------------+---------------------------------+
                                  |
                 +----------------+----------------+
                 v                                 v
+---------------------------------+ +-------------------------------+
|       Capa Multiagente          | |          Pipeline RAG         |
|  - Agente Orquestador / Router  | |  - Ingesta y fragmentación    |
|  - Agente de Políticas y Cultura| |  - Embeddings y Vector Store  |
|  - Agente de Beneficios/Trámites| |  - Recuperación contextual    |
|  - Agente de Onboarding         | |  - Base: docs/knowledge-base  |
+---------------------------------+ +-------------------------------+
```

### Flujo de alto nivel
1. **Usuario:** Realiza una consulta o solicitud desde el portal web en React + Vite.
2. **Backend API:** Recibe la petición, aplica validaciones/middlewares y la delega al orquestador multiagente.
3. **Orquestador Multiagente:** Clasifica la intención y enruta la tarea al agente especialista correspondiente.
4. **Pipeline RAG:** Cuando la consulta requiere normativa o conocimiento interno, recupera los fragmentos relevantes desde el almacenamiento vectorial indexado a partir de `docs/knowledge-base/`.
5. **Respuesta:** El agente sintetiza una respuesta fundamentada (con referencias a las políticas aplicables) y la devuelve al frontend.

---

## Estructura del repositorio

```text
.
├── .env.example                 # Plantilla de variables de entorno (sin credenciales)
├── .gitignore                   # Reglas de exclusión para Node.js, React, Vite y temporales
├── README.md                    # Documentación principal del proyecto
├── backend/                     # Servidor API, orquestación multiagente y pipeline RAG
│   ├── src/
│   │   ├── agents/              # Definición y coordinación de agentes especializados
│   │   ├── config/              # Configuración del servidor, entorno y clientes externos
│   │   ├── controllers/         # Controladores HTTP de los endpoints
│   │   ├── middlewares/         # Validación, autenticación y manejo de errores
│   │   ├── rag/                 # Ingesta, chunking, embeddings y recuperación semántica
│   │   ├── routes/              # Definición de rutas de la API
│   │   ├── services/            # Lógica de negocio del dominio de RRHH
│   │   └── utils/               # Utilidades compartidas del backend
│   └── tests/                   # Pruebas unitarias y de integración
├── docs/                        # Documentación técnica y base de conocimiento
│   ├── api/                     # Contratos y especificaciones de la API
│   ├── architecture/            # Diagramas y decisiones de arquitectura (ADRs)
│   ├── guides/                  # Guías de configuración, desarrollo y despliegue
│   └── knowledge-base/          # Documentos oficiales de RRHH para ingesta RAG
└── frontend/                    # Aplicación web SPA (React + Vite)
    ├── public/                  # Recursos estáticos públicos
    └── src/
        ├── assets/              # Imágenes, iconos y recursos gráficos
        ├── components/          # Componentes UI reutilizables
        ├── context/             # Contextos y estado global de React
        ├── hooks/               # Custom hooks
        ├── pages/               # Vistas principales del portal
        ├── services/            # Clientes de comunicación con el backend
        ├── styles/              # Hojas de estilo globales y tokens visuales
        └── utils/               # Funciones auxiliares del frontend
```

---

## Variables de entorno

El archivo [`.env.example`](.env.example) contiene las variables base esperadas (puerto del servidor, credenciales del proveedor LLM/embeddings, rutas de base de conocimiento y URL de la API para Vite).

Cuando se inicialicen los proyectos de `backend/` y `frontend/`, cada módulo deberá contar con su propio archivo `.env` local (ignorado por Git), nunca con credenciales reales versionadas.

