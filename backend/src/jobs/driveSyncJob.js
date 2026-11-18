'use strict';

const cron = require('node-cron');
const { syncDriveDocuments } = require('../agents/ingestaAgent');

let scheduledTask = null;
let isSyncing = false;

function startDriveSyncJob() {
  if (scheduledTask) {
    return scheduledTask;
  }

  // Se ejecuta al minuto 0 de cada hora (hora de Costa Rica)
  scheduledTask = cron.schedule(
    '0 * * * *',
    async () => {
      if (isSyncing) {
        console.log('[Cron DriveSync] Sincronización omitida: ya existe una ejecución en curso.');
        return;
      }

      isSyncing = true;
      try {
        console.log('[Cron DriveSync] Iniciando sincronización incremental (cada hora)...');
        const result = await syncDriveDocuments();
        console.log(
          `[Cron DriveSync] Completado: ${result.summary.totalActiveInFolder} docs, ${result.summary.totalChunks} chunks totales.`
        );
      } catch (err) {
        if (String(err.message || '').includes('en curso')) {
          console.log('[Cron DriveSync] Omitido por sincronización manual simultánea en curso.');
        } else {
          console.error('[Cron DriveSync] Error en sincronización automática:', err.message);
        }
      } finally {
        isSyncing = false;
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
