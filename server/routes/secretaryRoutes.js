// נתב המזכירה כתוב ב-CommonJS, כפי שמתאימים גם הבקר והמודל שלו.
const express = require('express');
const router = express.Router();
const secretaryController = require('../controllers/secretaryController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// יצירה או עדכון של הגדרות דורשים משתמש מאומת.
router.post('/setup', authenticateToken, secretaryController.setupSecretary);

// קביעת תור פתוחה ללקוח שמחזיק בקישור הייחודי של הבוט.
router.post('/:botUrlKey/book', secretaryController.bookAppointment);

// בקשת חופשה דורשת התחברות; הבקר מוודא גם שהבוט שייך למשתמש.
router.post('/:botId/emergency-vacation', authenticateToken, secretaryController.requestEmergencyVacation);

// מחזיר את הנתב לשימוש באפליקציה הראשית.
module.exports = router;