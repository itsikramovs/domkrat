import type { AdminPickList } from '@/lib/api/admin';

const esc = (s: string): string =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);

/** Печать листа отбора (walk-sheet) для FBO-заказа — отдельное окно + window.print. */
export function printPickList(label: string, items: AdminPickList['items']): void {
  const rows = items
    .map((it, i) => {
      const cells =
        it.suggested
          .map((s) => {
            const c = it.cells.find((x) => x.cellId === s.cellId);
            return `${esc(c?.code ?? '?')} × ${s.qty}`;
          })
          .join(', ') || (it.shortfall > 0 ? `без ячейки × ${it.shortfall}` : '—');
      const name = it.name?.ru ?? it.sku ?? '';
      return `<tr><td>${i + 1}</td><td>${esc(name)}</td><td>${esc(it.sku ?? '')}</td><td>${cells}</td><td class="c">${it.quantity}</td><td class="c">☐</td></tr>`;
    })
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Лист отбора ${esc(label)}</title>
<style>body{font:13px system-ui,Arial;padding:24px;color:#111}h1{font-size:18px;margin:0 0 4px}
.sub{color:#666;margin-bottom:14px}table{width:100%;border-collapse:collapse}
th,td{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#eee}.c{text-align:center}@media print{button{display:none}}</style></head>
<body><h1>Лист отбора — ${esc(label)}</h1><div class="sub">Отберите указанное количество из ячеек и отметьте ✓</div>
<table><thead><tr><th>№</th><th>Товар</th><th>SKU</th><th>Ячейки (FIFO)</th><th class="c">Кол-во</th><th class="c">✓</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
  const w = window.open('', '_blank', 'width=820,height=640');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
