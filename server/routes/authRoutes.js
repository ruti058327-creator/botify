// Express Router מקבץ את נתיבי החשבון תחת תחילית /api שמוגדרת באפליקציה.
import express from 'express';
import authController from '../controllers/authController.js';
import userController from '../controllers/userController.js';
import contactController from '../controllers/contactController.js';
import __cjsImport0 from '../middlewares/authMiddleware.js';
import profileImageUpload from '../middlewares/profileImageUpload.js';
import validateRequest from '../middlewares/validateRequest.js';
import { authSchemas, contactSchemas } from '../validation/schemas.js';

// מפיק את בדיקות האימות וההרשאה מה-middleware המשותף.
const { authenticateToken, requireAdmin } = __cjsImport0;

// יוצרים נתב ייעודי לחשבונות, פרופיל ופניות תמיכה.
const router = express.Router();

// נתיבי הרשמה ואימות קוד משתמשים בסכמות קלט לפני פעולות הבקר.
router.post('/send-otp', validateRequest(authSchemas.sendOtp), authController.sendRegistrationOtp);
router.post('/register-verify', validateRequest(authSchemas.registerVerify), authController.registerVerify);
router.post('/register', validateRequest(authSchemas.register), authController.register);
router.post('/login', validateRequest(authSchemas.login), authController.login);
router.post('/login-verify', validateRequest(authSchemas.loginVerify), authController.loginVerify);
router.post('/password-reset/request', validateRequest(authSchemas.passwordResetRequest), authController.requestPasswordReset);
router.post('/password-reset/confirm', validateRequest(authSchemas.passwordResetConfirm), authController.confirmPasswordReset);

// פעולות ניהול משתמשים דורשות גם אסימון תקין וגם תפקיד מנהל.
router.get('/users/count', authenticateToken, requireAdmin, userController.countUsers);
router.get('/users', authenticateToken, requireAdmin, userController.listUsers);
router.post(
  '/users/me/profile-image',
  // ההעלאה מוגנת בזהות המשתמש, נשמרת כקובץ יחיד ואז מקושרת לחשבון.
  authenticateToken,
  profileImageUpload.single('profileImage'),
  userController.uploadProfileImage
);

// פניות מנהל מוגנות, ופנייה/תגובה מקבלות אימות של תוכן הבקשה.
router.get('/messages', authenticateToken, requireAdmin, contactController.listAll);
router.get('/user-messages', authenticateToken, contactController.listMine);
router.post('/contact', authenticateToken, validateRequest(contactSchemas.create), contactController.create);
router.post('/reply', authenticateToken, requireAdmin, validateRequest(contactSchemas.reply), contactController.reply);

// מחזיר את הנתב לאפליקציה כדי שיחובר לתחילית API.
export default router;