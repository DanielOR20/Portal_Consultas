'use strict';

const cron = require('node-cron');
const { syncDriveDocuments } = require('../agents/ingestaAgent');

let scheduledTask = null;

function startDriveSyncJob() {
  if (scheduledTask) {
    return scheduledTask;
  }

  // Todos los días a las 06:30 a.m. hora de Costa Rica
  scheduledTask = cron.schedule(
    '30 6 * * *',
    async () => {
      try {
        console.log('[Cron DriveSync] Iniciando sincronización diaria (06:30 a.m.)...');
        const result = await syncDriveDocuments();
        console.log(
          `[Cron DriveSync] Completado: ${result.summary.totalActiveInFolder} docs, ${result.summary.totalChunks} chunks totales.`
        );
      } catch (err) {
        console.error('[Cron DriveSync] Error en sincronización automática:', err.message);
      }
    },
    {
      timezone: 'America/Costa_Rica'
    }
  );

  return scheduledTask;
}

module.exports = {
  startDriveSyncJob
};

