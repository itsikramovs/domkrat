'use client';

import { Car, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { CarPicker, type SelectedCar } from '@/components/car-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateGarage } from '@/lib/api/garage';
import { ApiHttpError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export default function AddCarPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const create = useCreateGarage();

  const [picked, setPicked] = useState<SelectedCar | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [year, setYear] = useState('');
  const [vin, setVin] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [mileage, setMileage] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);

  useEffect(() => {
    if (accessToken === null) router.push('/login?next=/account/garage/add');
  }, [accessToken, router]);
  if (!accessToken) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked?.modificationId) {
      toast.error('Выберите марку, модель и модификацию');
      return;
    }
    if (vin && vin.length !== 17) {
      toast.error('VIN должен быть 17 символов');
      return;
    }
    try {
      await create.mutateAsync({
        carModificationId: picked.modificationId,
        nickname: nickname || undefined,
        vin: vin || undefined,
        year: year ? Number(year) : undefined,
        licensePlate: licensePlate || undefined,
        mileage: mileage ? Number(mileage) : undefined,
        isPrimary,
      });
      toast.success('Машина добавлена в гараж');
      router.push('/account/garage');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Не удалось сохранить');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 px-4 py-6 md:px-0">
      <h1 className="text-xl font-bold md:text-2xl">Новый автомобиль</h1>

      <div className="space-y-2">
        <Label>Марка, модель и модификация *</Label>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-secondary"
        >
          <span className="inline-flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            {picked
              ? [
                  picked.makeName,
                  picked.modelName,
                  picked.generationName,
                  picked.modificationName,
                ].filter(Boolean).join(' · ')
              : 'Выбрать автомобиль'}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nickname">Прозвище (опц.)</Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Моя ласточка"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="year">Год выпуска</Label>
          <Input
            id="year"
            type="number"
            min={1980}
            max={2030}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2018"
            className="tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plate">Гос. номер</Label>
          <Input
            id="plate"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
            placeholder="01A123BB"
            className="font-mono"
            maxLength={20}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vin">VIN (опц., 17 знаков)</Label>
        <Input
          id="vin"
          value={vin}
          onChange={(e) => setVin(e.target.value.toUpperCase())}
          placeholder="WAUZZZ..."
          maxLength={17}
          className="font-mono tracking-wide"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mileage">Пробег, км</Label>
        <Input
          id="mileage"
          type="number"
          min={0}
          step={1000}
          value={mileage}
          onChange={(e) => setMileage(e.target.value)}
          placeholder="125000"
          className="tabular-nums"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span>Сделать основным авто (показывать совместимые товары на главной)</span>
      </label>

      <Button type="submit" size="lg" className="w-full" disabled={create.isPending}>
        {create.isPending ? 'Сохраняем…' : 'Сохранить машину'}
      </Button>

      <CarPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(s) => {
          setPicked(s);
          setPickerOpen(false);
        }}
        minDepth="modification"
        initial={picked ?? undefined}
      />
    </form>
  );
}
