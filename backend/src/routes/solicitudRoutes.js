'use strict';

const express = require('express');
const solicitudController = require('../controllers/solicitudController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

const router = express.Router();

router.post('/', authMiddleware, solicitudController.createSolicitud);
router.patch('/:id/status', authMiddleware, requireRole('rrhh'), solicitudController.updateSolicitudStatus);

module.exports = router;
