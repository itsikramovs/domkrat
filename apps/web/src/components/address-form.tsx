'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateAddressInput } from '@/lib/api/users';
import type { UserAddress } from '@/lib/types';

interface Props {
  initial?: UserAddress;
  busy: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (input: CreateAddressInput) => void | Promise<void>;
}

export function AddressForm({ initial, busy, submitLabel, onCancel, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [recipientName, setRecipientName] = useState(initial?.recipientName ?? '');
  const [recipientPhone, setRecipientPhone] = useState(initial?.recipientPhone ?? '+998');
  const [region, setRegion] = useState(initial?.region ?? 'Ташкент');
  const [city, setCity] = useState(initial?.city ?? 'Ташкент');
  const [district, setDistrict] = useState(initial?.district ?? '');
  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? '');
  const [landmark, setLandmark] = useState(initial?.landmark ?? '');
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [isLegal, setIsLegal] = useState(initial?.isLegalEntity ?? false);
  const [companyName, setCompanyName] = useState(initial?.companyName ?? '');
  const [taxId, setTaxId] = useState(initial?.taxId ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit({
      title: title.trim() || undefined,
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      region: region.trim(),
      city: city.trim(),
      district: district.trim() || undefined,
      addressLine: addressLine.trim(),
      landmark: landmark.trim() || undefined,
      isDefault,
      isLegalEntity: isLegal,
      companyName: isLegal ? companyName.trim() || undefined : undefined,
      taxId: isLegal ? taxId.trim() || undefined : undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="addr-title">Название (Дом / Офис)</Label>
        <Input
          id="addr-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Дом"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="addr-name">Получатель *</Label>
          <Input
            id="addr-name"
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Иван Петров"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="addr-phone">Телефон *</Label>
          <Input
            id="addr-phone"
            required
            type="tel"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            placeholder="+998901234567"
            className="font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="addr-region">Регион *</Label>
          <Input
            id="addr-region"
            required
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Ташкент"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="addr-city">Город *</Label>
          <Input
            id="addr-city"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ташкент"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addr-district">Район</Label>
        <Input
          id="addr-district"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder="Юнусабад"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="addr-line">Адрес (улица, дом, квартира) *</Label>
        <Input
          id="addr-line"
          required
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          placeholder="ул. Амира Темура, 15, кв. 42"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="addr-landmark">Ориентир (для курьера)</Label>
        <Input
          id="addr-landmark"
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
          placeholder="Рядом со школой №118"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span>Сделать основным адресом</span>
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isLegal}
          onChange={(e) => setIsLegal(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span>Юридическое лицо</span>
      </label>

      {isLegal ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="addr-company">Название компании</Label>
            <Input
              id="addr-company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="ООО Альфа"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addr-tax">ИНН / Tax ID</Label>
            <Input
              id="addr-tax"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="301234567"
              className="font-mono"
            />
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 pt-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="flex-1">
            Отмена
          </Button>
        ) : null}
        <Button type="submit" size="lg" disabled={busy} className="flex-1">
          {busy ? 'Сохраняем…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
