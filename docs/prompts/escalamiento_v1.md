# Prompt Versionado — Agente de Escalamiento (`escalamiento_v1.md`)

| Campo | Detalle |
| :--- | :--- |
| **Agente** | Agente de Escalamiento de Tickets RRHH (`escalamientoAgent.js`) |
| **Versión** | `v1.0` |
| **Persistencia** | Tabla `tickets_rrhh` vía Sequelize ORM (`TicketRRHH.count()`, `TicketRRHH.create()`) |
| **Responsabilidad** | Convertir consultas sin respaldo documental o excepciones operativas en tickets trazables con folio `TKT-YYYY-XXX` |

---

## 1. Flujo de Trabajo Determinista

1. Cuando `politicasAgent.js` retorna `escalada: true` (sin política vigente en Drive) o el colaborador solicita atención humana desde el chat, el frontend invoca `POST /api/tickets`.
2. `escalamientoAgent.js` calcula el siguiente número correlativo mediante Sequelize ORM (`TicketRRHH.count()` + último código) y genera el folio único `TKT-2026-XXX`.
3. Persiste el ticket en estado `'abierto'` asociado a `colaborador_id = req.user.id`.
4. El equipo con rol `'rrhh'` gestiona la bandeja desde `/dashboard` (`GET /api/tickets`) y emite la resolución oficial vía `PATCH /api/tickets/:id/resolve`, actualizando `estado = 'resuelto'`, `atendido_por` y `resuelto_en`.

