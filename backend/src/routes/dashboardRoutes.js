'use strict';

const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/latest', authMiddleware, requireRole('rrhh'), dashboardController.getLatest);
router.get('/history', authMiddleware, requireRole('rrhh'), dashboardController.getHistory);
router.post('/generate', authMiddleware, requireRole('rrhh'), dashboardController.generateManual);
router.get('/keywords', authMiddleware, requireRole('rrhh'), dashboardController.getKeywords);

module.exports = router;

