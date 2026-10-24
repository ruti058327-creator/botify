// הנתב מרכז פעולות צפייה, יצירה, עדכון ושיחה עם בוטים.
import express from 'express';
import botController from '../controllers/botController.js';
import __cjsImport0 from '../middlewares/authMiddleware.js';
import validateRequest from '../middlewares/validateRequest.js';
import { botSchemas } from '../validation/schemas.js';

const { authenticateToken } = __cjsImport0;

// כל נתיבי הניהול דורשים התחברות; נתיב השיחה עצמו נשאר ציבורי.
const router = express.Router();

// קריאת רשימה ומכסה מתבצעת תחת זהות משתמש מאומתת.
router.get('/', authenticateToken, botController.list);
router.get('/quota', authenticateToken, validateRequest(botSchemas.quota, 'query'), botController.quota);
// מזהי בוט עוברים אימות פרמטרים לפני גישה למסד הנתונים.
router.get('/:botId', authenticateToken, validateRequest(botSchemas.id, 'params'), botController.getById);
router.post('/create-bot', authenticateToken, validateRequest(botSchemas.create), botController.createFromWebsite);
router.put('/:botId', authenticateToken, validateRequest(botSchemas.id, 'params'), validateRequest(botSchemas.update), botController.update);
router.delete('/:botId', authenticateToken, validateRequest(botSchemas.id, 'params'), botController.remove);
// שיחת לקוח ציבורית עדיין מאמתת מזהה בוט ותוכן הודעה לפני הפעלת הבקר.
router.post('/:botId/chat', validateRequest(botSchemas.id, 'params'), validateRequest(botSchemas.chat), botController.chat);

// חושף את הנתב לאפליקציית Express.
export default router;