'use strict';

const cron = require('node-cron');
const { generateDailyReport } = require('../agents/analistaAgent');

let scheduledTask = null;

function startDailyReportJob() {
  if (scheduledTask) {
    return scheduledTask;
  }

  // Todos los días a las 07:00 a.m. hora de Costa Rica
  scheduledTask = cron.schedule(
    '0 7 * * *',
    async () => {
      try {
        console.log('[Cron DailyReport] Generando reporte diario RRHH (07:00 a.m.)...');
        const report = await generateDailyReport();
        console.log(`[Cron DailyReport] Reporte generado para la fecha ${report.fecha}.`);
      } catch (err) {
        console.error('[Cron DailyReport] Error generando reporte diario:', err.message);
      }
    },
    {
      timezone: 'America/Costa_Rica'
    }
  );

  return scheduledTask;
}

module.exports = {
  startDailyReportJob
};

