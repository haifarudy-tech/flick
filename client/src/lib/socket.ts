import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Singleton socket bound to the current access token. When the token rotates
// (via refresh), disconnect and reconnect using the new token so the server's
// handshake auth picks it up.

let socket: Socket | null = null;
let boundToken: string | null = null;

function createSocket(token: string): Socket {
  return io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });
}

export function getSocket(): Socket | null {
  const token = useAuthStore.getState().accessToken;
  if (!token) return null;
  if (socket && boundToken === token) return socket;
  // Token changed (first connect or refresh) — tear down and rebuild.
  if (socket) socket.disconnect();
  socket = createSocket(token);
  boundToken = token;
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    boundToken = null;
  }
}

// Subscribe the socket to access-token changes. Call once after React mounts.
export function wireSocketToAuth() {
  useAuthStore.subscribe((state, prev) => {
    if (state.accessToken !== prev.accessToken) {
      // On sign-out or token invalidation, tear down.
      if (!state.accessToken) {
        disconnectSocket();
        return;
      }
      // On token refresh, rebuild the socket with the new token.
      getSocket();
    }
  });
}
