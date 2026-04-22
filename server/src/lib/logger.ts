import { pino } from 'pino';
import { env, isProd } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.passwordHash',
      '*.pinHash',
      '*.accessToken',
      '*.refreshToken',
      '*.stripeSecretKey',
    ],
    censor: '[REDACTED]',
  },
});
