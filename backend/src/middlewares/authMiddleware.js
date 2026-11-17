'use strict';

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      error: 'Token de autenticación requerido (Bearer).'
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'Token de autenticación vacío.'
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      ok: false,
      error: 'Configuración de JWT_SECRET faltante en el servidor.'
    });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      nombre: decoded.nombre,
      departamento: decoded.departamento,
      rol: decoded.rol
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      error: 'Token inválido o expirado.'
    });
  }
}

module.exports = authMiddleware;

