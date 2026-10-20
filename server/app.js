import './config/env.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import createRequestLogger from './middlewares/requestLogger.js';
import errorHandler from './middlewares/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import botRoutes from './routes/botRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import httpError from './utils/httpError.js';

const app = express();

app.use(createRequestLogger('Botify'));
app.use(express.json());
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
app.use(express.static(fileURLToPath(new URL('../public/pages', import.meta.url))));
app.use('/api', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/payments', paymentRoutes);

app.use((req, res, next) => next(httpError(404, 'הנתיב המבוקש לא נמצא')));
app.use(errorHandler);

export default app;
