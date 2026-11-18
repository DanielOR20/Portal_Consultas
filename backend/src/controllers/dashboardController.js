'use strict';

const { z } = require('zod');
const { ReporteDiario, PalabraClave } = require('../models');
const { generateDailyReport } = require('../agents/analistaAgent');
const { invalidateKeywordsCache } = require('../agents/orquestadorAgent');
const { invalidatePolicyTermsCache } = require('../agents/politicasAgent');

const VALID_CATEGORIES = [
  'restringida',
  'fuera_alcance',
  'politica',
  'dato_personal',
  'tema_dashboard'
];

const createKeywordSchema = z.object({
  palabra: z
    .string({ required_error: 'La palabra clave es obligatoria.' })
    .trim()
    .min(2, 'Mínimo 2 caracteres.')
    .max(100),
  categoria: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({ message: 'Categoría de palabra clave inválida.' })
  }),
  tema_asociado: z.string().trim().max(100).nullable().optional()
});

const updateKeywordSchema = z.object({
  palabra: z.string().trim().min(2).max(100).optional(),
  categoria: z.enum(VALID_CATEGORIES).optional(),
  tema_asociado: z.string().trim().max(100).nullable().optional(),
  activa: z.boolean().optional()
});

function invalidateAllKeywordCaches() {
  invalidateKeywordsCache();
  invalidatePolicyTermsCache();
}

async function getLatest(req, res, next) {
  try {
    let report = await ReporteDiario.findOne({
      order: [['fecha', 'DESC']]
    });

    if (!report) {
      report = await generateDailyReport();
    }

    return res.status(200).json({
      ok: true,
      reporte: report
    });
  } catch (err) {
    return next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const { fecha } = req.query;

    if (fecha) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
        return res.status(400).json({
          ok: false,
          error: 'Formato de fecha inválido. Utiliza YYYY-MM-DD.'
        });
      }

      const reporte = await ReporteDiario.findOne({ where: { fecha } });
      if (!reporte) {
        return res.status(404).json({
          ok: false,
          error: `No existe reporte registrado para la fecha ${fecha}.`
        });
      }

      return res.status(200).json({
        ok: true,
        reporte
      });
    }

    const reportes = await ReporteDiario.findAll({
      attributes: ['id', 'fecha', 'generado_por'],
      order: [['fecha', 'DESC']],
      limit: 30
    });

    return res.status(200).json({
      ok: true,
      fechas_disponibles: reportes.map((r) => r.fecha),
      reportes
    });
  } catch (err) {
    return next(err);
  }
}

async function generateManual(req, res, next) {
  try {
    const targetDate = req.body?.fecha || null;
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(targetDate))) {
      return res.status(400).json({
        ok: false,
        error: 'Formato de fecha inválido. Utiliza YYYY-MM-DD.'
      });
    }

    const report = await generateDailyReport(targetDate);
    return res.status(200).json({
      ok: true,
      reporte: report
    });
  } catch (err) {
    return next(err);
  }
}

async function getKeywords(req, res, next) {
  try {
    const includeInactive = req.query.all === 'true';
    const whereClause = includeInactive ? {} : { activa: true };

    const rows = await PalabraClave.findAll({
      where: whereClause,
      order: [
        ['categoria', 'ASC'],
        ['palabra', 'ASC']
      ],
      raw: true
    });

    const agrupadas = {};
    for (const row of rows) {
      if (!agrupadas[row.categoria]) {
        agrupadas[row.categoria] = [];
      }
      agrupadas[row.categoria].push({
        id: row.id,
        palabra: row.palabra,
        categoria: row.categoria,
        tema_asociado: row.tema_asociado,
        activa: Boolean(row.activa)
      });
    }

    return res.status(200).json({
      ok: true,
      total: rows.length,
      keywords: rows.map((r) => ({ ...r, activa: Boolean(r.activa) })),
      keywords_por_categoria: agrupadas
    });
  } catch (err) {
    return next(err);
  }
}

async function createKeyword(req, res, next) {
  try {
    const parsed = createKeywordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Datos de palabra clave inválidos.'
      });
    }

    const palabra = parsed.data.palabra.toLowerCase();
    const { categoria, tema_asociado } = parsed.data;

    const duplicate = await PalabraClave.findOne({
      where: { palabra, categoria }
    });
    if (duplicate) {
      return res.status(409).json({
        ok: false,
        error: `La palabra "${palabra}" ya existe en la categoría ${categoria}.`
      });
    }

    const created = await PalabraClave.create({
      palabra,
      categoria,
      tema_asociado: tema_asociado || null,
      activa: true
    });

    invalidateAllKeywordCaches();

    return res.status(201).json({
      ok: true,
      keyword: created
    });
  } catch (err) {
    return next(err);
  }
}

async function updateKeyword(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const parsed = updateKeywordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Datos de actualización inválidos.'
      });
    }

    const record = await PalabraClave.findByPk(id);
    if (!record) {
      return res.status(404).json({ ok: false, error: 'Palabra clave no encontrada.' });
    }

    const updates = {};
    if (parsed.data.palabra !== undefined) updates.palabra = parsed.data.palabra.toLowerCase();
    if (parsed.data.categoria !== undefined) updates.categoria = parsed.data.categoria;
    if (parsed.data.tema_asociado !== undefined) updates.tema_asociado = parsed.data.tema_asociado;
    if (parsed.data.activa !== undefined) updates.activa = parsed.data.activa;

    await record.update(updates);
    invalidateAllKeywordCaches();

    return res.status(200).json({
      ok: true,
      keyword: record
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteKeyword(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const deletedCount = await PalabraClave.destroy({ where: { id } });
    if (deletedCount === 0) {
      return res.status(404).json({ ok: false, error: 'Palabra clave no encontrada.' });
    }

    invalidateAllKeywordCaches();

    return res.status(200).json({
      ok: true,
      deletedId: id
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getLatest,
  getHistory,
  generateManual,
  getKeywords,
  createKeyword,
  updateKeyword,
  deleteKeyword
};
