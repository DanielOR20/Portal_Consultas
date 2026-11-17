'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const app = require('./app');
const { sequelize } = require('./models');
const { startDriveSyncJob } = require('./jobs/driveSyncJob');
const { startDailyReportJob } = require('./jobs/dailyReportJob');

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Conexión con MySQL verificada correctamente.');

    startDriveSyncJob();
    console.log('Cron diario de sincronización con Google Drive programado (06:30 a.m.).');

    startDailyReportJob();
    console.log('Cron diario de reporte analítico RRHH programado (07:00 a.m.).');

    app.listen(PORT, () => {
      console.log(`Servidor API escuchando en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Error fatal al iniciar el servidor:', err.message);
    process.exit(1);
  }
}

startServer();

