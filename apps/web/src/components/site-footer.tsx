'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function SiteFooter() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t bg-muted/30 mt-12">
      <div className="container py-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4 text-sm">
        <div>
          <div className="font-semibold mb-2">Домкрат</div>
          <p className="text-muted-foreground">{t('tagline')}</p>
        </div>
        <div>
          <div className="font-semibold mb-2">{t('catalog')}</div>
          <ul className="space-y-1">
            <li>
              <Link className="text-muted-foreground hover:underline" href="/c/tires-and-wheels">
                Шины и диски
              </Link>
            </li>
            <li>
              <Link className="text-muted-foreground hover:underline" href="/c/consumables">
                Расходники
              </Link>
            </li>
            <li>
              <Link className="text-muted-foreground hover:underline" href="/c/brake-system">
                Тормозная система
              </Link>
            </li>
            <li>
              <Link className="text-muted-foreground hover:underline" href="/brands">
                Все бренды
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2">{t('info')}</div>
          <ul className="space-y-1">
            <li>
              <Link className="text-muted-foreground hover:underline" href="/terms">
                {t('terms')}
              </Link>
            </li>
            <li>
              <Link className="text-muted-foreground hover:underline" href="/privacy">
                {t('privacy')}
              </Link>
            </li>
            <li>
              <Link className="text-muted-foreground hover:underline" href="/offer">
                {t('offer')}
              </Link>
            </li>
            <li>
              <Link className="text-muted-foreground hover:underline" href="/returns-policy">
                {t('returnsPolicy')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2">{t('contacts')}</div>
          <p className="text-muted-foreground">+998 71 200 00 00</p>
          <p className="text-muted-foreground">support@domkrat.uz</p>
        </div>
      </div>
      <div className="border-t">
        <div className="container py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Домкрат. {t('rights')}.
        </div>
      </div>
    </footer>
  );
}
