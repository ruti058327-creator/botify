import express from 'express';
import { createPayment } from '../controllers/paymentController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import validateRequest from '../middlewares/validateRequest.js';
import { paymentSchema } from '../validation/schemas.js';

const router = express.Router();

router.post('/', authenticateToken, validateRequest(paymentSchema), createPayment);

export default router;
