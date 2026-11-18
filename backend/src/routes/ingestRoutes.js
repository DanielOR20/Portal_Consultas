'use strict';

const express = require('express');
const ingestController = require('../controllers/ingestController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

const router = express.Router();

router.post('/sync', authMiddleware, requireRole('rrhh'), ingestController.triggerSync);
router.get('/status', authMiddleware, ingestController.getStatus);
router.get('/documents', authMiddleware, ingestController.getDocuments);

module.exports = router;
