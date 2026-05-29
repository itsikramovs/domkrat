'use client';

import { useId } from 'react';

// ------------------------------------------------------------------ Area chart
export function AreaChart({
  data,
  height = 200,
  stroke = 'rgba(255,255,255,0.95)',
  fillFrom = 'rgba(255,255,255,0.45)',
  fillTo = 'rgba(255,255,255,0.02)',
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  stroke?: string;
  fillFrom?: string;
  fillTo?: string;
}) {
  const id = useId().replace(/:/g, '');
  const W = 720;
  const H = height;
  const padY = 16;
  const n = data.length;
  if (n === 0) return <div className="text-sm text-white/60">Нет данных за период</div>;

  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = n > 1 ? W / (n - 1) : W;
  const pts: Array<[number, number]> = data.map((d, i) => [
    n > 1 ? i * stepX : W / 2,
    H - (d.value / max) * (H - padY * 2) - padY,
  ]);

  const line = smoothPath(pts);
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  // показываем ~6 подписей по оси X
  const tickEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-auto w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillFrom} />
            <stop offset="100%" stopColor={fillTo} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#area-${id})`} />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-white/55">
        {data.map((d, i) => (i % tickEvery === 0 ? <span key={i}>{d.label}</span> : null))}
      </div>
    </div>
  );
}

function smoothPath(pts: Array<[number, number]>): string {
  const first = pts[0];
  if (pts.length < 2 || !first) return first ? `M ${first[0]} ${first[1]}` : '';
  let d = `M ${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// ----------------------------------------------------------------------- Donut
export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 200,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2 - 16;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={16}
        />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={16}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{centerValue}</span>
        <span className="text-xs text-white/65">{centerLabel}</span>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Ring progress
export function RingProgress({
  percent,
  color = '#fff',
  size = 84,
}: {
  percent: number;
  color?: string;
  size?: number;
}) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  const len = (p / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={7}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeDasharray={`${len} ${c - len}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
        {Math.round(p)}%
      </div>
    </div>
  );
}
