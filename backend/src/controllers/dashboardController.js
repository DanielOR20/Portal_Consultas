'use strict';

const { ReporteDiario, PalabraClave } = require('../models');
const { generateDailyReport } = require('../agents/analistaAgent');

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
    const rows = await PalabraClave.findAll({
      where: { activa: true },
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
        tema_asociado: row.tema_asociado
      });
    }

    return res.status(200).json({
      ok: true,
      total: rows.length,
      keywords_por_categoria: agrupadas
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getLatest,
  getHistory,
  generateManual,
  getKeywords
};

