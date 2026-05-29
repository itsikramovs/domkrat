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
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-accent to-secondary shadow-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-card-hover group-active:scale-95">
        <Icon
          className="h-8 w-8 text-primary transition-transform duration-200 group-hover:scale-110"
          strokeWidth={1.75}
        />
      </div>
      <span className="line-clamp-2 text-xs font-medium leading-tight text-foreground/90 md:text-sm">
        {pickLocale(category.name)}
      </span>
    </Link>
  );
}
