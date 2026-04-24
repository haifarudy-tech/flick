import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { verifyAccessToken } from '../lib/jwt.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

let io: SocketIOServer | null = null;

export function initSocketServer(http: HttpServer): SocketIOServer {
  io = new SocketIOServer(http, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
  });

  // Auth handshake: clients send { auth: { token } }
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Missing token'));
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      socket.join(`business:${payload.businessId}`);
      return next();
    } catch (err) {
      logger.warn({ err }, 'socket auth failed');
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const biz = socket.data.user?.businessId;
    socket.on('join:kitchen', () => socket.join(`business:${biz}:kitchen`));
    socket.on('join:orders', () => socket.join(`business:${biz}:orders`));
    socket.on('join:delivery', () => socket.join(`business:${biz}:delivery`));
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialised');
  return io;
}

// Convenience emitters — used from controllers/jobs.
export function emitOrderNew(businessId: string, order: unknown) {
  io?.to(`business:${businessId}`).emit('order:new', order);
}
export function emitOrderUpdated(businessId: string, order: unknown) {
  io?.to(`business:${businessId}`).emit('order:updated', order);
}
export function emitOrderCancelled(
  businessId: string,
  payload: { orderId: string; reason?: string },
) {
  io?.to(`business:${businessId}`).emit('order:cancelled', payload);
}
export function emitPlatformOrder(businessId: string, order: unknown) {
  io?.to(`business:${businessId}:delivery`).emit('platform:order', order);
}
export function emitMenuSynced(businessId: string, payload: unknown) {
  io?.to(`business:${businessId}`).emit('menu:synced', payload);
}
