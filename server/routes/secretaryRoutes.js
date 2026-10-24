// נתב המזכירה כתוב ב-CommonJS, כפי שמתאימים גם הבקר והמודל שלו.
const express = require('express');
const router = express.Router();
const secretaryController = require('../controllers/secretaryController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// הגדרה או עדכון ראשוני של בוט המזכירה (דורש אימות של בעל העסק)
router.post('/setup', authenticateToken, secretaryController.setupSecretary);

// נתיב לשליפת לוח שנה חודשי של הבוט (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.get('/:botUrlKey/calendar-month', secretaryController.getMonthCalendar);

// נתיב לבדיקה אם תאריך מסוים הוא חופשה או שבת (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.get('/:botUrlKey/is-holiday-or-shabbat', secretaryController.isHolidayOrShabbat);

// נתיב להמרת זמן למספר דקות (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.get('/:botUrlKey/time-to-minutes', secretaryController.timeToMinutes);

// נתיב להמרת מספר דקות לזמן (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.get('/:botUrlKey/minutes-to-time', secretaryController.minutesToTime);

// קביעת תור חדש על ידי לקוח (פתוח לציבור דרך הקישור הייחודי של הבוט)
router.post('/:botUrlKey/book', secretaryController.bookAppointment);

// נתיב לשליפת שעות פנויות ללקוח לפי תאריך
router.get('/:botUrlKey/slots', secretaryController.getAvailableSlots);

// בקשת חופשה פתאומית על ידי בעל העסק (דורש אימות)
router.post('/:botId/emergency-vacation', authenticateToken, secretaryController.requestEmergencyVacation);

// מחזיר את הנתב לשימוש באפליקציה הראשית.
module.exports = router;