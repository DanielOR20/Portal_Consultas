'use strict';

const express = require('express');
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, chatController.postChat);
router.get('/history', authMiddleware, chatController.getChatHistory);

module.exports = router;

