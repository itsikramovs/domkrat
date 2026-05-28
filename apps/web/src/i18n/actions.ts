'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { LOCALE_COOKIE, isLocale } from './config';

export async function setLocale(formData: FormData): Promise<void> {
  const next = formData.get('locale')?.toString();
  if (!isLocale(next)) return;
  cookies().set(LOCALE_COOKIE, next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}
