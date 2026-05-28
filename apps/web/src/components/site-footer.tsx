import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30 mt-12">
      <div className="container py-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4 text-sm">
        <div>
          <div className="font-semibold mb-2">Домкрат</div>
          <p className="text-muted-foreground">
            Маркетплейс автотоваров и запчастей для Узбекистана.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-2">Каталог</div>
          <ul className="space-y-1">
            <li><Link className="text-muted-foreground hover:underline" href="/c/tires-and-wheels">Шины и диски</Link></li>
            <li><Link className="text-muted-foreground hover:underline" href="/c/consumables">Расходники</Link></li>
            <li><Link className="text-muted-foreground hover:underline" href="/c/brake-system">Тормозная система</Link></li>
            <li><Link className="text-muted-foreground hover:underline" href="/brands">Все бренды</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2">Информация</div>
          <ul className="space-y-1">
            <li><Link className="text-muted-foreground hover:underline" href="/terms">Условия использования</Link></li>
            <li><Link className="text-muted-foreground hover:underline" href="/privacy">Конфиденциальность</Link></li>
            <li><Link className="text-muted-foreground hover:underline" href="/offer">Публичная оферта</Link></li>
            <li><Link className="text-muted-foreground hover:underline" href="/returns-policy">Возврат и обмен</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2">Контакты</div>
          <p className="text-muted-foreground">+998 71 200 00 00</p>
          <p className="text-muted-foreground">support@domkrat.uz</p>
        </div>
      </div>
      <div className="border-t">
        <div className="container py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Домкрат. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
