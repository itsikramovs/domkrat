import Decimal from 'decimal.js';

import { PricingService, type PriceableItem } from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  describe('calculate', () => {
    it('возвращает нули для пустой корзины', () => {
      const r = service.calculate([]);
      expect(r.subtotal.toString()).toBe('0');
      expect(r.vatAmount.toString()).toBe('0');
      expect(r.total.toString()).toBe('0');
    });

    it('считает subtotal без скидки и доставки', () => {
      const items: PriceableItem[] = [
        { unitPrice: '100000', quantity: 2, vatRate: 12 },
      ];
      const r = service.calculate(items);
      expect(r.subtotal.toString()).toBe('200000');
      expect(r.total.toString()).toBe('200000');
    });

    it('правильно считает НДС 12% по умолчанию (без поля vatRate)', () => {
      const items: PriceableItem[] = [{ unitPrice: '100000', quantity: 1 }];
      const r = service.calculate(items);
      expect(r.subtotal.toString()).toBe('100000');
      expect(r.vatAmount.toString()).toBe('12000');
    });

    it('считает НДС с пользовательской ставкой', () => {
      const items: PriceableItem[] = [
        { unitPrice: '100000', quantity: 1, vatRate: 20 },
      ];
      const r = service.calculate(items);
      expect(r.vatAmount.toString()).toBe('20000');
    });

    it('суммирует НДС по разным товарам с разными ставками', () => {
      const items: PriceableItem[] = [
        { unitPrice: '100000', quantity: 2, vatRate: 12 }, // vat = 24000
        { unitPrice: '50000', quantity: 4, vatRate: 0 }, // vat = 0
        { unitPrice: '300000', quantity: 1, vatRate: 20 }, // vat = 60000
      ];
      const r = service.calculate(items);
      expect(r.subtotal.toString()).toBe('700000');
      expect(r.vatAmount.toString()).toBe('84000');
    });

    it('применяет скидку (вычитается из total)', () => {
      const items: PriceableItem[] = [{ unitPrice: '100000', quantity: 2 }];
      const r = service.calculate(items, { discount: 30000 });
      expect(r.subtotal.toString()).toBe('200000');
      expect(r.discount.toString()).toBe('30000');
      expect(r.total.toString()).toBe('170000');
    });

    it('добавляет стоимость доставки в total', () => {
      const items: PriceableItem[] = [{ unitPrice: '100000', quantity: 1 }];
      const r = service.calculate(items, { deliveryCost: 25000 });
      expect(r.subtotal.toString()).toBe('100000');
      expect(r.deliveryCost.toString()).toBe('25000');
      expect(r.total.toString()).toBe('125000');
    });

    it('total = subtotal - discount + delivery', () => {
      const items: PriceableItem[] = [{ unitPrice: '100000', quantity: 3 }];
      const r = service.calculate(items, { discount: 50000, deliveryCost: 25000 });
      // 300000 - 50000 + 25000 = 275000
      expect(r.total.toString()).toBe('275000');
    });

    it('не теряет точность на дробных ценах (избегаем float bug)', () => {
      const items: PriceableItem[] = [
        { unitPrice: '0.1', quantity: 3 }, // должно быть ровно 0.30, а не 0.30000000000000004
      ];
      const r = service.calculate(items);
      expect(r.subtotal.toString()).toBe('0.3');
    });

    it('округляет НДС до 2 знаков half-up', () => {
      const items: PriceableItem[] = [
        // 333 * 0.12 = 39.96
        { unitPrice: '333', quantity: 1, vatRate: 12 },
      ];
      const r = service.calculate(items);
      expect(r.vatAmount.toString()).toBe('39.96');
    });

    it('работает с Decimal-инстансами вход', () => {
      const items: PriceableItem[] = [
        { unitPrice: new Decimal('99.99'), quantity: 100, vatRate: new Decimal(12) },
      ];
      const r = service.calculate(items);
      // 99.99 * 100 = 9999
      expect(r.subtotal.toString()).toBe('9999');
      // 9999 * 0.12 = 1199.88
      expect(r.vatAmount.toString()).toBe('1199.88');
    });
  });

  describe('round', () => {
    it('round 12.345 → 12.35 (half-up)', () => {
      expect(service.round('12.345').toString()).toBe('12.35');
    });

    it('round 12.344 → 12.34', () => {
      expect(service.round('12.344').toString()).toBe('12.34');
    });

    it('round до 0 знаков для сумов', () => {
      expect(service.round('1234.56', 0).toString()).toBe('1235');
    });
  });
});
