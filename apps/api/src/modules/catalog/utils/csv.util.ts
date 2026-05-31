/** Минимальный CSV: генерация и разбор прайс-листов (RFC4180-совместимо, для Excel/Sheets). */

export function toCsv(rows: Array<Array<string | number>>): string {
  const esc = (cell: string | number): string => {
    const s = String(cell ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM — чтобы Excel корректно открывал UTF-8 (кириллица)
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // отбрасываем полностью пустые строки
  return rows.filter((r) => !(r.length === 1 && r[0]!.trim() === ''));
}
