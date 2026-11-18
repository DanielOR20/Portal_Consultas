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
router.post('/keywords', authMiddleware, requireRole('rrhh'), dashboardController.createKeyword);
router.patch('/keywords/:id', authMiddleware, requireRole('rrhh'), dashboardController.updateKeyword);
router.delete('/keywords/:id', authMiddleware, requireRole('rrhh'), dashboardController.deleteKeyword);

module.exports = router;
