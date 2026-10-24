import express from 'express';
import secretaryController from '../controllers/secretaryController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// הגדרה או עדכון ראשוני של בוט המזכירה (דורש אימות של בעל העסק)
router.post('/setup', authenticateToken, secretaryController.setupSecretary);

// בוטי המזכירה השייכים לבעל העסק
router.get('/mine', authenticateToken, secretaryController.getOwnedSecretaryBots);

// מחיקת בוט מזכירה על ידי בעל העסק
router.delete('/:botUrlKey', authenticateToken, secretaryController.deleteSecretaryBot);

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

// צפייה בתורים המאושרים של העסק (דורש אימות של בעל העסק)
router.get('/:botUrlKey/appointments', authenticateToken, secretaryController.getBusinessAppointments);

// עדכון הגדרות הבוט על ידי בעל העסק (דורש אימות)
router.patch('/:botUrlKey/settings', authenticateToken, secretaryController.updateBotSettings);

// נתיב לאישור קריאה של הלקוח על ידי לחיצה על הקישור במייל (פתוח לציבור)
router.get('/confirm-read/:token', secretaryController.confirmReadMessage);

// בקשת חופשה פתאומית ושליחת הודעה ללקוחות של הבוט
router.post('/:botUrlKey/emergency-vacation', authenticateToken, secretaryController.requestEmergencyVacation);

export default router;
