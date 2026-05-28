'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAnalyticsSummary } from '@/lib/api/analytics';
import { Card, CardContent } from '@/components/ui/card';

function formatSum(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num) + ' сум';
}

function pickName(name: unknown): string {
  if (name && typeof name === 'object') {
    const obj = name as { ru?: string; uz?: string };
    return obj.ru ?? obj.uz ?? 'Без названия';
  }
  return 'Без названия';
}

export function AnalyticsCard({ range = 30 }: { range?: number }) {
  const { data, isLoading } = useAnalyticsSummary(range);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Загрузка аналитики…</CardContent>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Нет данных</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">Заказы за {range} дн.</div>
            <div className="text-3xl font-bold">{data.orders.total}</div>
            <div className="text-xs text-muted-foreground mt-1">
              из них {data.orders.completed} завершено, {data.orders.cancelled} отменено
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">Оборот</div>
            <div className="text-3xl font-bold">{formatSum(data.revenue.gross)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              комиссия: {formatSum(data.revenue.commission)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">К выплате</div>
            <div className="text-3xl font-bold">{formatSum(data.revenue.payout)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              средний чек: {formatSum(data.averageCheck)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">Каталог</div>
            <div className="text-3xl font-bold">{data.inventory.activeProducts}</div>
            <div className="text-xs text-muted-foreground mt-1">
              всего {data.inventory.totalProducts},
              {data.inventory.outOfStock
                ? ` нет в наличии: ${data.inventory.outOfStock}`
                : ' все на складе'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 font-semibold">Выручка по дням</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip formatter={(value) => formatSum(Number(value))} />
                <Line
                  type="monotone"
                  dataKey={(d) => Number(d.revenue)}
                  name="Выручка"
                  stroke="#1d6cf5"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 font-semibold">Топ-5 товаров (по количеству продаж)</div>
          {data.topProducts.length === 0 ? (
            <div className="text-sm text-muted-foreground">Пока нет продаж за период</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topProducts.map((p) => ({ ...p, displayName: pickName(p.name) }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="displayName"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="quantitySold" name="Шт." fill="#1d6cf5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
