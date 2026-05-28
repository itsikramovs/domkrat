'use client';

import { Car, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuthStore } from '@/lib/auth-store';

export default function GaragePage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  useEffect(() => {
    if (accessToken === null) router.push('/login?next=/account/garage');
  }, [accessToken, router]);
  if (!accessToken) return null;

  return (
    <div className="space-y-4 px-4 py-6 md:px-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Мои автомобили</h1>
        <Link
          href="/account/garage/add"
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Добавить
        </Link>
      </div>
      <div className="space-y-4 rounded-2xl bg-card p-8 text-center">
        <Car className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Расскажите о вашем авто, чтобы мы показывали только совместимые запчасти.
        </p>
        <Link
          href="/account/garage/add"
          className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Добавить машину
        </Link>
      </div>
    </div>
  );
}
