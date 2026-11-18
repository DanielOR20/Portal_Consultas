'use strict';

const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const authRoutes = require('./routes/authRoutes');
const ingestRoutes = require('./routes/ingestRoutes');
const chatRoutes = require('./routes/chatRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const solicitudRoutes = require('./routes/solicitudRoutes');

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) ||
        /^http:\/\/localhost:\d+$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    return res.status(200).json({
      ok: true,
      service: 'novacore-portal-rrhh-backend',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      service: 'novacore-portal-rrhh-backend',
      database: 'disconnected',
      error: 'No se pudo conectar con MySQL.'
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/solicitudes', solicitudRoutes);

app.use((req, res) => {
  return res.status(404).json({
    ok: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[Error ${status}] ${req.method} ${req.originalUrl}:`, err.message);
  return res.status(status).json({
    ok: false,
    error: err.message || 'Error interno del servidor.'
  });
});

module.exports = app;

