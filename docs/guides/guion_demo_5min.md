# Guion de Video Demo — 5 Minutos

| Campo | Detalle |
| :--- | :--- |
| **Proyecto** | Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente |
| **Empresa Modelo** | NovaCore Technologies Costa Rica S.A. |
| **Duración Total** | 5 minutos exactos (`0:00` a `5:00`) |
| **Cuentas de Demo** | Colaborador: `carlos.solano@novacore.cr` · RRHH: `laura.mendez@novacore.cr` (clave: `NovaCore2026!`) |

---

## Preparación Previa antes de Grabar

1. Verificar que MySQL esté activo con `portal_rrhh_db` migrada y poblada.
2. Tener en ejecución el backend (`cd backend && npm run dev` en puerto `3000`) y el frontend (`cd frontend && npm run dev` en puerto `5173`).
3. Abrir tres pestañas en el navegador:
   - Pestaña 1: Carpeta oficial de **Google Drive** con los 10 documentos (Docs, Sheets y PDF).
   - Pestaña 2: Portal en **`http://localhost:5173/login`**.
   - Pestaña 3 (opcional): Cliente REST o terminal mostrando `GET /api/health` y la carpeta `docs/prompts/`.

---

## Guion Minuto a Minuto (`0:00` – `5:00`)

### `0:00 – 0:45` · Introducción, Problema y Base Documental en Google Drive
- **En pantalla:** Mostrar brevemente el `README.md` / diagrama de arquitectura y cambiar a la **Pestaña 1 (Google Drive)**.
- **Narración:**
  > "Hola, presentamos el Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente para NovaCore Technologies Costa Rica S.A., una empresa ficticia de tecnología B2B con 250 colaboradores regida por el Código de Trabajo de Costa Rica. El corazón documental vive en esta carpeta de Google Drive, con 10 documentos oficiales distribuidos en Google Docs, Google Sheets y PDF, cada uno con su tabla de metadatos: título, código y versión, fecha de vigencia y responsable."
- **Acción:** Señalar un Google Doc (`Política de Vacaciones` / `Permisos`), el PDF (`Manual de Onboarding, Periodo de Prueba y Proceso de Salida.pdf`) y la hoja de cálculo en Drive.

### `0:45 – 1:45` · Login como Colaborador y Consulta de Política con Cita Verificable
- **En pantalla:** Ir a **`http://localhost:5173/login`** (diseño corporativo Vino y Blanco `#722F37` / `#FAF7F8`). Hacer clic en **"Entrar como Colaborador (Carlos Solano)"** para iniciar sesión al instante con 1 clic.
- **Narración:**
  > "Ingresamos primero con el perfil de Carlos Solano, desarrollador con rol `colaborador`. En el panel izquierdo el sistema muestra su perfil autenticado por JWT, una barra de progreso en tono vino con su saldo de vacaciones real consultado desde MySQL (11 días disponibles de 15 asignados) y el explorador de preguntas filtrado por categorías."
- **Acción:** Hacer clic en la pestaña **Vacaciones** o **Pagos** y enviar: **`¿Cuántos días de vacaciones me corresponden al año?`** (o usar el botón de **Micrófono** para dictar por voz en `es-CR`).
- **Destacar en UI:** Mostrar las burbujas en vino `#722F37`, el badge **`Validado`** del `validadorAgent`, el botón **"Escuchar"** (`speechSynthesis`), el botón **"Copiar respuesta"** (*"¡Copiado!"*), los chips de agente/latencia (`latencia_ms`), las cifras exactas (`15 días hábiles`, `15 de diciembre`, fórmula de 12 meses) y la tarjeta de **Cita Oficial** con el botón **"Abrir documento en Drive"**.

### `1:45 – 2:45` · Pregunta Mixta (MySQL + RAG), Guardrail de Privacidad y Escalamiento
- **En pantalla:** Permanecer en `/chat` como `carlos.solano@novacore.cr`.
- **Acción 1 (Pregunta Mixta):** Enviar **`¿Cuántos días me quedan y puedo pasar los que sobren al otro año?`**.
  - **Narración:** "Aquí el `AgenteOrquestadorMixto` ejecuta en paralelo al Agente de Datos Personales en MySQL y al Agente RAG en Drive: combina los 11 días disponibles reales de Carlos con el tope de acumulación de 20 días hábiles de la política `POL-RRHH-01`, manteniendo la cita oficial."
- **Acción 2 (Guardrail Privacidad):** Enviar **`¿Cuál es el salario del gerente general?`** (o **`¿Cuántos días de vacaciones tiene mi compañero Juan?`**).
  - **Narración:** "Si un colaborador intenta consultar salarios o saldos de terceros, el `OrquestadorGuardrail` bloquea la solicitud de inmediato citando la Ley N.° 8968 de Costa Rica, sin ejecutar consultas a MySQL y garantizando cero fuga de datos."
- **Acción 3 (Sin Respuesta / Escalamiento + Ticket Real):** Enviar **`¿La empresa da bono por mascotas?`**.
  - **Narración:** "Cuando se pregunta por un beneficio que no existe en los documentos oficiales, el sistema no alucina ni inventa montos: muestra la tarjeta interactiva de escalamiento (`escalada: true`) y al hacer clic en **Confirmar envío de consulta a Talento Humano**, el `escalamientoAgent` genera un ticket real en MySQL (ej. `Ticket #TKT-2026-004 creado ✓`) visible en la sección **Mis Tickets RRHH** del panel izquierdo."

### `2:45 – 3:30` · Control de Acceso RBAC y Cambio a Rol RRHH
- **En pantalla:** Intentar navegar manualmente en la barra de direcciones a `http://localhost:5173/dashboard` estando logueado como `colaborador` -> mostrar que `ProtectedRoute` redirige automáticamente a `/chat` y la pestaña **Dashboard RRHH** ni siquiera aparece en la barra superior color Vino Profundo (`#4E1A21`).
- **Acción:** Hacer clic en **"Cerrar sesión"**, luego en **"Entrar como RRHH (Laura Méndez)"**.
- **Narración:** "Ahora ingresamos con 1 clic como Laura Méndez, Directora de Talento Humano con rol `rrhh`. Automáticamente se habilita el acceso al Dashboard RRHH y en el chat puede consultar conteos agregados de la empresa, como `¿Cuántas personas están de vacaciones hoy?`."

### `3:30 – 4:40` · Dashboard Analítico de RRHH, Reporte Diario y Sincronización Drive
- **En pantalla:** Hacer clic en **"Dashboard RRHH"** (`/dashboard`).
- **Narración y recorrido visual:**
  1. **Barra superior:** Mostrar el indicador `Drive RAG: 10 docs · 31 chunks`, el selector histórico de fechas, los botones **"Descargar Reporte: CSV / JSON"**, **"Regenerar Reporte"** y **"Sincronizar Google Drive"** con notificaciones Toast en vino y blanco.
  2. **Resumen Ejecutivo:** Leer brevemente cómo el Agente Analista sintetiza en 3 a 5 frases las cifras reales calculadas en Sequelize ORM (cero SQL crudo).
  3. **Fila de 5 KPIs Interactivos:** Hacer clic en *Solicitudes Pendientes* o *Riesgo Pasivo (>20d)* para demostrar el scroll suave y resaltado hacia la sección correspondiente.
  4. **Gráficos Chart.js en paleta Vino/Blanco:** Tendencia de 30 días, Top temas clasificados dinámicamente desde la tabla `palabras_clave` y Ausencias por departamento.
  5. **Bandeja de Tickets Escalados y Gestor CRUD de Palabras Clave:** Responder y resolver el ticket recién creado por Carlos desde la **Bandeja de Tickets Escalados**, y mostrar cómo RRHH puede crear, activar/desactivar o eliminar palabras clave en `palabras_clave` con invalidación inmediata de caché.
  6. **Tabla de pendientes y Alertas:** Usar el buscador instantáneo y filtro **Críticas > 3 días**, mostrar las alertas de pasivo `> 20 días` y las brechas documentales.
- **Acción:** Presionar **"Sincronizar Drive"** para demostrar la sincronización incremental (`0` cambios si no se editó Drive, `unchanged: 10`).

### `4:40 – 5:00` · Cierre y Métricas de Evaluación
- **En pantalla:** Mostrar brevemente el resumen de `docs/evaluacion/hoja_evaluacion_45_preguntas.md`.
- **Narración:**
  > "En nuestras pruebas automatizadas sobre el banco de 45 preguntas —25 base y 20 propias— validamos precisión factual con citas reales, respuestas por debajo de los 8 segundos y cero fugas de datos privados. Con esto concluimos la demostración del Portal Interno de RRHH Multiagente con RAG de NovaCore Technologies Costa Rica. ¡Muchas gracias!"

