import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container py-8 max-w-3xl">
      <article className="prose prose-sm sm:prose-base max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-8 prose-p:text-foreground/80 prose-li:text-foreground/80 prose-a:text-primary prose-strong:text-foreground">
        {children}
      </article>
    </div>
  );
}
