import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

export interface PriceableItem {
  unitPrice: Decimal | number | string;
  quantity: number;
  vatRate?: Decimal | number | string;
}

export interface PriceBreakdown {
  subtotal: Decimal;     // сумма (unit_price * qty) без НДС
  vatAmount: Decimal;
  discount: Decimal;
  deliveryCost: Decimal;
  total: Decimal;        // = subtotal + vat + delivery - discount
}

const VAT_RATE_DEFAULT = new Decimal(12);

@Injectable()
export class PricingService {
  /**
   * Расчёт корзины: цены в БД уже с НДС-неттo (наша конвенция),
   * НДС считается отдельно для отчётности.
   * Для MVP считаем: subtotal = sum(unitPrice * qty), vat = subtotal * vat_rate%.
   * Discount применяется до НДС; delivery — после.
   */
  calculate(
    items: PriceableItem[],
    options: { discount?: Decimal | number | string; deliveryCost?: Decimal | number | string } = {},
  ): PriceBreakdown {
    let subtotal = new Decimal(0);
    let vatAmount = new Decimal(0);

    for (const item of items) {
      const unit = new Decimal(item.unitPrice as Decimal | number | string);
      const lineSubtotal = unit.times(item.quantity);
      subtotal = subtotal.plus(lineSubtotal);

      const rate = new Decimal((item.vatRate ?? VAT_RATE_DEFAULT) as Decimal | number | string);
      vatAmount = vatAmount.plus(lineSubtotal.times(rate).dividedBy(100));
    }

    const discount = new Decimal(options.discount ?? 0);
    const deliveryCost = new Decimal(options.deliveryCost ?? 0);
    const total = subtotal.minus(discount).plus(deliveryCost);

    return {
      subtotal: this.round(subtotal),
      vatAmount: this.round(vatAmount),
      discount: this.round(discount),
      deliveryCost: this.round(deliveryCost),
      total: this.round(total),
    };
  }

  round(value: Decimal | number | string, decimals = 2): Decimal {
    return new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  }
}
