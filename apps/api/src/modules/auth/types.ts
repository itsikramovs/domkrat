import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string | null;
  roles: UserRole[];
  merchantId: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  roles: UserRole[];
  merchantId: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds — TTL access token
}

export interface UserResponse {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: UserRole[];
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
}
