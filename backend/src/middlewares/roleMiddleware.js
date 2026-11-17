'use strict';

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no autenticado.'
      });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        ok: false,
        error: 'Acceso denegado. No cuentas con el rol autorizado para esta acción.'
      });
    }

    return next();
  };
}

module.exports = requireRole;

