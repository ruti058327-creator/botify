const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.get('/', authenticateToken, botController.list);
router.get('/:botId', authenticateToken, botController.getById);
router.post('/create-bot', authenticateToken, botController.createFromWebsite);
router.put('/:botId', authenticateToken, botController.update);
router.delete('/:botId', authenticateToken, botController.remove);
router.post('/:botId/chat', botController.chat);

module.exports = router;