const express = require('express');
const router = express.Router();
const secretaryController = require('../controllers/secretaryController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// 1. הגדרה או עדכון ראשוני של בוט המזכירה (דורש אימות של בעל העסק)
router.post('/setup', authenticateToken, secretaryController.setupSecretary);

// 2. קביעת תור חדש על ידי לקוח (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.post('/:botUrlKey/book', secretaryController.bookAppointment);

// 3. בקשת חופשה פתאומית על ידי בעל העסק (דורש אימות)
router.post('/:botId/emergency-vacation', authenticateToken, secretaryController.requestEmergencyVacation);

module.exports = router;