// הנתב מגדיר נקודת קצה יחידה לרישום תשלום ולהפעלת מסלול.
import express from 'express';
import { createPayment } from '../controllers/paymentController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import validateRequest from '../middlewares/validateRequest.js';
import { paymentSchema } from '../validation/schemas.js';

// יוצר נתב נפרד כדי לצרף את פעולת התשלום לאפליקציה.
const router = express.Router();

// דורש התחברות, בודק את שדות התשלום ורק אז מפעיל את הבקר.
router.post('/', authenticateToken, validateRequest(paymentSchema), createPayment);

// חושף את הנתב לקובץ האפליקציה.
export default router;
