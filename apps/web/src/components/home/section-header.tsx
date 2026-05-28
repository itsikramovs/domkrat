import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function SectionHeader({
  title,
  href,
  hrefLabel = 'Все',
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between px-4 md:px-0">
      <h2 className="text-lg font-bold md:text-xl">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
        >
          {hrefLabel}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
