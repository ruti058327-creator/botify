const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const contactController = require('../controllers/contactController');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');
const profileImageUpload = require('../middlewares/profileImageUpload');

router.post('/send-otp', authController.sendRegistrationOtp);
router.post('/register-verify', authController.registerVerify);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/login-verify', authController.loginVerify);
router.post('/password-reset/request', authController.requestPasswordReset);
router.post('/password-reset/confirm', authController.confirmPasswordReset);

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
router.post('/contact', authenticateToken, contactController.create);
router.post('/reply', authenticateToken, requireAdmin, contactController.reply);

module.exports = router;