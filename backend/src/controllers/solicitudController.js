'use strict';

const { z } = require('zod');
const { sequelize, Solicitud, SaldoVacaciones, Colaborador } = require('../models');

const VALID_TIPOS = ['vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'teletrabajo'];

const createSolicitudSchema = z.object({
  tipo: z.enum(VALID_TIPOS, {
    errorMap: () => ({ message: 'Tipo de solicitud inválido.' })
  }),
  fecha_inicio: z
    .string({ required_error: 'La fecha de inicio es obligatoria.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido en fecha_inicio (YYYY-MM-DD).'),
  fecha_fin: z
    .string({ required_error: 'La fecha de fin es obligatoria.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido en fecha_fin (YYYY-MM-DD).')
});

const updateStatusSchema = z.object({
  estado: z.enum(['aprobada', 'rechazada'], {
    errorMap: () => ({ message: 'El estado debe ser aprobada o rechazada.' })
  })
});

function parseIsoUtc(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dateStr) {
    return null;
  }
  return d;
}

/**
 * Calcula los días hábiles (lun-vie) entre fecha_inicio y fecha_fin (inclusive).
 * Si el rango abarca únicamente fin de semana, utiliza la cantidad de días calendario (>= 1).
 */
function calculateRequestedDays(fechaInicio, fechaFin) {
  const start = parseIsoUtc(fechaInicio);
  const end = parseIsoUtc(fechaFin);
  if (!start || !end || start > end) return 0;

  let businessDays = 0;
  let calendarDays = 0;
  const cursor = new Date(start.getTime());

  while (cursor <= end) {
    calendarDays += 1;
    const dow = cursor.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      businessDays += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Math.max(1, businessDays > 0 ? businessDays : calendarDays);
}

async function createSolicitud(req, res, next) {
  try {
    const parsed = createSolicitudSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Datos de solicitud inválidos.'
      });
    }

    const { tipo, fecha_inicio, fecha_fin } = parsed.data;
    const start = parseIsoUtc(fecha_inicio);
    const end = parseIsoUtc(fecha_fin);

    if (!start || !end) {
      return res.status(400).json({
        ok: false,
        error: 'Las fechas proporcionadas no son válidas.'
      });
    }

    if (start > end) {
      return res.status(400).json({
        ok: false,
        error: 'La fecha de inicio no puede ser posterior a la fecha de fin.'
      });
    }

    const diasSolicitados = calculateRequestedDays(fecha_inicio, fecha_fin);

    if (tipo === 'vacaciones') {
      const saldo = await SaldoVacaciones.findOne({
        where: { colaborador_id: req.user.id },
        order: [['periodo', 'DESC']]
      });

      const disponibles = Number(saldo?.dias_disponibles ?? 0);
      if (!saldo || disponibles < diasSolicitados) {
        return res.status(400).json({
          ok: false,
          error: `Saldo de vacaciones insuficiente: tienes ${disponibles.toFixed(2)} días disponibles y solicitaste ${diasSolicitados} día(s) hábil(es).`
        });
      }
    }

    const created = await Solicitud.create({
      colaborador_id: req.user.id,
      tipo,
      fecha_inicio,
      fecha_fin,
      estado: 'pendiente'
    });

    const solicitud = await Solicitud.findByPk(created.id, {
      include: [
        {
          model: Colaborador,
          as: 'colaborador',
          attributes: ['id', 'nombre', 'departamento', 'puesto']
        }
      ]
    });

    return res.status(201).json({
      ok: true,
      dias_solicitados: diasSolicitados,
      solicitud
    });
  } catch (err) {
    return next(err);
  }
}

async function updateSolicitudStatus(req, res, next) {
  try {
    const solicitudId = Number(req.params.id);
    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'ID de solicitud inválido.'
      });
    }

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Estado de solicitud inválido.'
      });
    }

    const existing = await Solicitud.findByPk(solicitudId);
    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: 'Solicitud no encontrada.'
      });
    }

    if (existing.estado !== 'pendiente') {
      return res.status(409).json({
        ok: false,
        error: `La solicitud ya fue procesada con estado "${existing.estado}".`
      });
    }

    const { estado } = parsed.data;
    let diasDescontados = 0;

    await sequelize.transaction(async (t) => {
      const [affectedRows] = await Solicitud.update(
        {
          estado,
          aprobador_id: req.user.id
        },
        {
          where: { id: solicitudId, estado: 'pendiente' },
          transaction: t
        }
      );

      if (affectedRows === 0) {
        const conflictErr = new Error('La solicitud ya no se encuentra en estado pendiente.');
        conflictErr.statusCode = 409;
        throw conflictErr;
      }

      if (estado === 'aprobada' && existing.tipo === 'vacaciones') {
        diasDescontados = calculateRequestedDays(existing.fecha_inicio, existing.fecha_fin);

        const saldo = await SaldoVacaciones.findOne({
          where: { colaborador_id: existing.colaborador_id },
          order: [['periodo', 'DESC']],
          transaction: t
        });

        const disponiblesActuales = Number(saldo?.dias_disponibles ?? 0);
        if (!saldo || disponiblesActuales < diasDescontados) {
          const balErr = new Error(
            `No es posible aprobar: el colaborador solo dispone de ${disponiblesActuales.toFixed(2)} días de vacaciones.`
          );
          balErr.statusCode = 400;
          throw balErr;
        }

        const nuevosTomados = Number((Number(saldo.dias_tomados) + diasDescontados).toFixed(2));
        const nuevosDisponibles = Number((disponiblesActuales - diasDescontados).toFixed(2));

        await SaldoVacaciones.update(
          {
            dias_tomados: nuevosTomados,
            dias_disponibles: nuevosDisponibles
          },
          {
            where: { id: saldo.id },
            transaction: t
          }
        );
      }
    });

    const solicitud = await Solicitud.findByPk(solicitudId, {
      include: [
        {
          model: Colaborador,
          as: 'colaborador',
          attributes: ['id', 'nombre', 'departamento', 'puesto']
        },
        {
          model: Colaborador,
          as: 'aprobador',
          attributes: ['id', 'nombre', 'email']
        }
      ]
    });

    return res.status(200).json({
      ok: true,
      dias_descontados: diasDescontados,
      solicitud
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createSolicitud,
  updateSolicitudStatus,
  calculateRequestedDays
};
