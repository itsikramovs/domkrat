'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, ApiHttpError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export default function AddCarPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [makeName, setMakeName] = useState('');
  const [modelName, setModelName] = useState('');
  const [year, setYear] = useState('');
  const [vin, setVin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (accessToken === null) router.push('/login?next=/account/garage/add');
  }, [accessToken, router]);
  if (!accessToken) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/users/me/garage', {
        method: 'POST',
        body: {
          makeName,
          modelName,
          year: year ? Number(year) : undefined,
          vin: vin.trim() || undefined,
        },
      });
      toast.success('Машина добавлена в гараж');
      router.push('/account/garage');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 px-4 py-6 md:px-0">
      <h1 className="text-xl font-bold md:text-2xl">Новый автомобиль</h1>
      <div className="space-y-2">
        <Label htmlFor="make">Марка</Label>
        <Input id="make" value={makeName} onChange={(e) => setMakeName(e.target.value)} placeholder="Chevrolet" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="model">Модель</Label>
        <Input id="model" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Lacetti" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="year">Год выпуска</Label>
          <Input id="year" type="number" min={1980} max={2030} value={year} onChange={(e) => setYear(e.target.value)} placeholder="2018" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vin">VIN (опц.)</Label>
          <Input
            id="vin"
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            placeholder="WAUZZZ..."
            maxLength={17}
            className="font-mono"
          />
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'Сохраняем…' : 'Сохранить машину'}
      </Button>
    </form>
  );
}
