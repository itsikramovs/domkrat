import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/**
 * Помечает endpoint как открытый — не требует JWT.
 * Используется глобальным JwtAuthGuard для пропуска авторизации.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
