import express from 'express';
import botController from '../controllers/botController.js';
import __cjsImport0 from '../middlewares/authMiddleware.js';
import validateRequest from '../middlewares/validateRequest.js';
import { botSchemas } from '../validation/schemas.js';

const { authenticateToken } = __cjsImport0;

const router = express.Router();

router.get('/', authenticateToken, botController.list);
router.get('/quota', authenticateToken, validateRequest(botSchemas.quota, 'query'), botController.quota);
router.get('/:botId', authenticateToken, validateRequest(botSchemas.id, 'params'), botController.getById);
router.post('/create-bot', authenticateToken, validateRequest(botSchemas.create), botController.createFromWebsite);
router.put('/:botId', authenticateToken, validateRequest(botSchemas.id, 'params'), validateRequest(botSchemas.update), botController.update);
router.delete('/:botId', authenticateToken, validateRequest(botSchemas.id, 'params'), botController.remove);
router.post('/:botId/chat', validateRequest(botSchemas.id, 'params'), validateRequest(botSchemas.chat), botController.chat);

export default router;