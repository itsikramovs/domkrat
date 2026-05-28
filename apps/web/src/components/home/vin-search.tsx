'use client';

import { Camera, ChevronRight, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/utils';

type Tab = 'vin' | 'details';

export function VinSearch() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('vin');
  const [vin, setVin] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = vin.trim();
    if (q.length >= 6) {
      router.push(`/search?vin=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div className="relative mx-4 overflow-hidden rounded-2xl bg-hero p-5 text-hero-foreground md:mx-0">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <h3 className="relative text-base font-bold md:text-lg">Найдём нужное</h3>

      <div className="relative mt-3 inline-flex gap-1 rounded-full bg-white/10 p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab('vin')}
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
            tab === 'vin' ? 'bg-white text-foreground' : 'text-white/80',
          )}
        >
          VIN
        </button>
        <button
          type="button"
          onClick={() => setTab('details')}
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
            tab === 'details' ? 'bg-white text-foreground' : 'text-white/80',
          )}
        >
          Подробнее
        </button>
      </div>

      {tab === 'vin' ? (
        <form onSubmit={submit} className="relative mt-3 flex flex-col gap-2">
          <div className="relative">
            <input
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              maxLength={17}
              placeholder="Введите VIN — 17 символов (A-Z, 0-9)"
              className="h-11 w-full rounded-full bg-white/10 px-4 pr-28 font-mono text-sm tracking-wide text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 inline-flex h-9 -translate-y-1/2 items-center gap-1 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
            >
              <Search className="h-3.5 w-3.5" />
              Найти
            </button>
          </div>
          <button
            type="button"
            className="self-center text-xs text-white/80 hover:text-white"
          >
            или <Camera className="inline h-3 w-3" /> сфокусировать камерой
          </button>
        </form>
      ) : (
        <div className="relative mt-3 space-y-2">
          <button
            type="button"
            onClick={() => router.push('/catalog')}
            className="flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-medium"
          >
            <span>Выбрать марку и модель</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
