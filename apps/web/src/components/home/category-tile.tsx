import {
  AlignVerticalSpaceAround,
  Armchair,
  BatteryCharging,
  Car,
  CircleDot,
  Cog,
  Disc3,
  Droplet,
  Filter,
  Package,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import type { Category } from '@/lib/types';
import { pickLocale } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  fluids: Droplet,
  'tires-and-wheels': CircleDot,
  'body-parts': Car,
  interior: Armchair,
  consumables: Filter,
  'brake-system': Disc3,
  'engine-parts': Cog,
  electrical: BatteryCharging,
  suspension: AlignVerticalSpaceAround,
  accessories: Package,
};

export function CategoryTile({ category }: { category: Category }) {
  const Icon = ICONS[category.slug] ?? Wrench;
  return (
    <Link
      href={`/c/${category.slug}`}
      className="group flex flex-col items-center gap-2 text-center"
      aria-label={pickLocale(category.name)}
    >
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-secondary transition-transform group-active:scale-95">
        <Icon className="h-8 w-8 text-primary" strokeWidth={1.75} />
      </div>
      <span className="line-clamp-2 text-xs font-medium leading-tight md:text-sm">
        {pickLocale(category.name)}
      </span>
    </Link>
  );
}
