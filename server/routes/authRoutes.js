import express from 'express';
import authController from '../controllers/authController.js';
import userController from '../controllers/userController.js';
import contactController from '../controllers/contactController.js';
import __cjsImport0 from '../middlewares/authMiddleware.js';
import profileImageUpload from '../middlewares/profileImageUpload.js';
import validateRequest from '../middlewares/validateRequest.js';
import { authSchemas, contactSchemas } from '../validation/schemas.js';

const { authenticateToken, requireAdmin } = __cjsImport0;

const router = express.Router();

router.post('/send-otp', validateRequest(authSchemas.sendOtp), authController.sendRegistrationOtp);
router.post('/register-verify', validateRequest(authSchemas.registerVerify), authController.registerVerify);
router.post('/register', validateRequest(authSchemas.register), authController.register);
router.post('/login', validateRequest(authSchemas.login), authController.login);
router.post('/login-verify', validateRequest(authSchemas.loginVerify), authController.loginVerify);
router.post('/password-reset/request', validateRequest(authSchemas.passwordResetRequest), authController.requestPasswordReset);
router.post('/password-reset/confirm', validateRequest(authSchemas.passwordResetConfirm), authController.confirmPasswordReset);

router.get('/users/count', authenticateToken, requireAdmin, userController.countUsers);
router.get('/users', authenticateToken, requireAdmin, userController.listUsers);
router.post(
  '/users/me/profile-image',
  authenticateToken,
  profileImageUpload.single('profileImage'),
  userController.uploadProfileImage
);

router.get('/messages', authenticateToken, requireAdmin, contactController.listAll);
router.get('/user-messages', authenticateToken, contactController.listMine);
router.post('/contact', authenticateToken, validateRequest(contactSchemas.create), contactController.create);
router.post('/reply', authenticateToken, requireAdmin, validateRequest(contactSchemas.reply), contactController.reply);

export default router;