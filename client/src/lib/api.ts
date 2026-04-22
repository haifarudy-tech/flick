import { authSnapshot, useAuthStore } from '@/stores/auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  // When true, a 401 won't attempt refresh + retry (used by the refresh call itself)
  skipRefresh?: boolean;
  // Raw text response (e.g. CSV export). Default is JSON.
  raw?: boolean;
}

// Serializes a refresh across multiple concurrent 401s into a single network call.
let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string };
      useAuthStore.getState().setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      // Clear the in-flight marker right after this call returns.
      // The promise closes over the freshly-set token before the clear.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();
  return refreshInFlight;
}

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, raw, skipRefresh, headers, ...rest } = opts;
  const token = authSnapshot().accessToken;

  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Try a one-shot refresh + retry on 401.
  if (res.status === 401 && !skipRefresh) {
    const refreshed = await performRefresh();
    if (refreshed) {
      return request<T>(path, { ...opts, skipRefresh: true });
    }
    useAuthStore.getState().clear();
  }

  if (!res.ok) {
    let errPayload: { error?: { message?: string; code?: string; details?: unknown } } = {};
    try {
      errPayload = (await res.json()) as typeof errPayload;
    } catch {
      /* body isn't JSON */
    }
    throw new ApiError(
      res.status,
      errPayload.error?.message ?? `Request failed (${res.status})`,
      errPayload.error?.code,
      errPayload.error?.details,
    );
  }

  if (raw) return (await res.text()) as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: ApiOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T>(path: string, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

// Boot-time refresh — attempts to rehydrate the session from the refresh cookie.
// Called once at app mount; if it fails, the user is shown /login.
export async function bootstrapSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      useAuthStore.getState().setStatus('unauthenticated');
      return false;
    }
    const data = (await res.json()) as { accessToken: string };
    useAuthStore.getState().setAccessToken(data.accessToken);
    return true;
  } catch {
    useAuthStore.getState().setStatus('unauthenticated');
    return false;
  }
}
