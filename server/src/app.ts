import express from 'express';
import http from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env, isProd } from './lib/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSocketServer } from './services/socket.js';

import authRoutes from './routes/auth.routes.js';
import businessRoutes from './routes/business.routes.js';
import menuRoutes, { publicRouter as publicMenuRoutes } from './routes/menu.routes.js';
import orderRoutes from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import deliveryRoutes from './routes/delivery.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import staffRoutes from './routes/staff.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import { deleteAccount } from './controllers/account.controller.js';
import { requireAuth } from './middleware/auth.js';

const app = express();

// ---- security & baseline middleware ----
app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false, // controlled by the frontend
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(morgan(isProd ? 'combined' : 'dev'));

// IMPORTANT: webhook routes use raw body and must be mounted BEFORE json parser.
app.use('/webhooks', webhookRoutes);

app.use(express.json({ limit: '1mb' }));

// Global rate limit as a safety net — auth routes have a stricter one applied.
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ---- health ----
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'flick-server', env: env.NODE_ENV });
});

// ---- API routes ----
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/business', businessRoutes);
app.use('/api/v1/menu', publicMenuRoutes);
app.use('/api/v1/menu', menuRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.delete('/api/v1/account', requireAuth, deleteAccount);

// ---- 404 + error handler ----
app.use((_req, res) =>
  res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } }),
);
app.use(errorHandler);

// ---- http server + socket.io ----
const server = http.createServer(app);
initSocketServer(server);

server.listen(env.PORT, () => {
  logger.info(`Flick server listening on :${env.PORT} (${env.NODE_ENV})`);
});

export default app;
