import { parseCsv, toCsv } from './csv.util';

describe('csv.util', () => {
  it('toCsv экранирует запятые/кавычки/переводы строк + BOM', () => {
    const out = toCsv([
      ['sku', 'name', 'price'],
      ['A,1', 'Имя "X"', 1000],
    ]);
    expect(out.startsWith('﻿')).toBe(true);
    expect(out).toContain('"A,1"');
    expect(out).toContain('"Имя ""X"""');
  });

  it('parseCsv разбирает кавычки, экранированные кавычки и CRLF', () => {
    const rows = parseCsv('sku,name\r\n"A,1","Имя ""X"""\r\nB,Простой\r\n');
    expect(rows).toEqual([
      ['sku', 'name'],
      ['A,1', 'Имя "X"'],
      ['B', 'Простой'],
    ]);
  });

  it('round-trip сохраняет значения', () => {
    const data = [
      ['sku', 'price', 'status'],
      ['SKU-1', '1000.50', 'ACTIVE'],
      ['SKU,2', 'INACTIVE'],
    ];
    expect(parseCsv(toCsv(data))).toEqual(data);
  });

  it('пустые строки отбрасываются', () => {
    expect(parseCsv('sku\r\n\r\nA\r\n')).toEqual([['sku'], ['A']]);
  });
});
