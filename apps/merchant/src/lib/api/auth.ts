'use client';

import { apiFetch } from '@/lib/api-client';
import { type AuthUser } from '@/lib/auth-store';

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface RegisterResponse {
  userId: string;
  message: string;
  expiresIn: number;
}

export const authApi = {
  register: (body: { email: string; password: string; firstName: string; lastName: string }) =>
    apiFetch<RegisterResponse>('/auth/register', { method: 'POST', body }),

  verifyEmail: (body: { email: string; code: string }) =>
    apiFetch<AuthTokensResponse>('/auth/verify-email', { method: 'POST', body }),

  login: (body: { email: string; password: string }) =>
    apiFetch<AuthTokensResponse>('/auth/login', { method: 'POST', body }),

  passwordResetRequest: (body: { email: string }) =>
    apiFetch<{ message: string }>('/auth/password-reset/request', { method: 'POST', body }),

  passwordResetConfirm: (body: { email: string; code: string; newPassword: string }) =>
    apiFetch<{ message: string }>('/auth/password-reset/confirm', { method: 'POST', body }),
};
