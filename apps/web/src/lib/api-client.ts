/**
 * Универсальный fetch wrapper:
 *   - На сервере → INTERNAL_API_URL (localhost:3001) для production-стабильности
 *   - На клиенте → NEXT_PUBLIC_API_URL (192.168.1.8:3001) — браузер ходит напрямую
 *   - Авто-инжекция Bearer токена из auth store (только клиент)
 *   - Авто-rotate при 401 (если есть refresh token)
 */

import { useAuthStore } from './auth-store';

const PUBLIC_API_URL =
  process.env['NEXT_PUBLIC_API_URL'] ?? 'http://192.168.1.8:3001/api/v1';
const INTERNAL_API_URL =
  process.env['INTERNAL_API_URL'] ?? 'http://localhost:3001/api/v1';

function getBaseUrl(): string {
  return typeof window === 'undefined' ? INTERNAL_API_URL : PUBLIC_API_URL;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export class ApiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message ?? `HTTP ${status}`);
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string | null;
  /** Bypass auto-refresh on 401 (используется внутри самого refresh-вызова) */
  noRetry?: boolean;
}

async function rawFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData)
      ? JSON.stringify(options.body)
      : (options.body as BodyInit | null | undefined),
    cache: options.cache ?? 'no-store',
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    throw new ApiHttpError(res.status, (data ?? { statusCode: res.status, message: res.statusText }) as ApiError);
  }
  return data as T;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  // Клиентский фетч использует auth store; серверный — только переданный token
  const isClient = typeof window !== 'undefined';
  const token = options.token ?? (isClient ? useAuthStore.getState().accessToken : null);

  try {
    return await rawFetch<T>(path, { ...options, token });
  } catch (error) {
    if (
      error instanceof ApiHttpError &&
      error.status === 401 &&
      isClient &&
      !options.noRetry
    ) {
      // Пытаемся refresh
      const refreshed = await useAuthStore.getState().refresh();
      if (refreshed) {
        return rawFetch<T>(path, {
          ...options,
          token: useAuthStore.getState().accessToken,
          noRetry: true,
        });
      }
    }
    throw error;
  }
}

/** Wrapper для server components — токен можно прокинуть из cookies. */
export function serverApi(token?: string) {
  return <T>(path: string, options: ApiRequestOptions = {}) =>
    rawFetch<T>(path, { ...options, token: token ?? null });
}
