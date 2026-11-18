'use strict';

const express = require('express');
const ticketController = require('../controllers/ticketController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

const router = express.Router();

router.post('/', authMiddleware, ticketController.createTicket);
router.get('/mine', authMiddleware, ticketController.getMyTickets);
router.get('/', authMiddleware, requireRole('rrhh'), ticketController.getAllTickets);
router.patch('/:id/resolve', authMiddleware, requireRole('rrhh'), ticketController.resolveTicket);

module.exports = router;

