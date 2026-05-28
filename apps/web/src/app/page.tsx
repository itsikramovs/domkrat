import { BrandsCarousel } from '@/components/home/brands-carousel';
import { CarOnboarding } from '@/components/home/car-onboarding';
import { CategoryTile } from '@/components/home/category-tile';
import { HeroBanner } from '@/components/home/hero-banner';
import { HorizontalProducts } from '@/components/home/horizontal-products';
import { MyCarProducts } from '@/components/home/my-car-products';
import { ProductCard } from '@/components/home/product-card';
import { SecondaryBanner } from '@/components/home/secondary-banner';
import { SectionHeader } from '@/components/home/section-header';
import { VinSearch } from '@/components/home/vin-search';
import { serverApi } from '@/lib/api-client';
import type { Banner, Brand, Category, Paginated, Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

export default async function HomePage() {
  const api = serverApi();
  const empty = { data: [] as Product[], meta: { page: 1, perPage: 0, total: 0, totalPages: 0 } };

  const [
    heroBanners,
    secondaryBanners,
    categories,
    seasonProducts,
    maintenance,
    body,
    accessories,
    cosmetics,
    electronics,
    brands,
  ] = await Promise.all([
    safe(api<Banner[]>('/banners?position=HOME_MAIN&limit=1'), []),
    safe(api<Banner[]>('/banners?position=HOME_SECONDARY&limit=1'), []),
    safe(api<Category[]>('/categories'), []),
    safe(api<Paginated<Product>>('/products?featured=true&perPage=8&sort=popular'), empty),
    safe(api<Paginated<Product>>('/products?categorySlug=fluids&perPage=6&sort=popular'), empty),
    safe(api<Paginated<Product>>('/products?categorySlug=body-parts&perPage=6&sort=popular'), empty),
    safe(api<Paginated<Product>>('/products?categorySlug=accessories&perPage=6&sort=popular'), empty),
    safe(api<Paginated<Product>>('/products?categorySlug=consumables&perPage=6&sort=popular'), empty),
    safe(api<Paginated<Product>>('/products?categorySlug=electrical&perPage=6&sort=popular'), empty),
    safe(api<Brand[]>('/brands/popular?limit=10'), []),
  ]);

  const hero = heroBanners[0];
  const secondary = secondaryBanners[0];

  return (
    <div className="space-y-6 py-3 md:container md:py-6">
      {hero ? (
        <div className="px-4 md:px-0">
          <HeroBanner banner={hero} />
        </div>
      ) : null}

      <section>
        <SectionHeader title="Категории" href="/catalog" />
        <div className="grid grid-cols-4 gap-3 px-4 md:grid-cols-6 md:gap-4 md:px-0 lg:grid-cols-10">
          {categories.slice(0, 10).map((c) => (
            <CategoryTile key={c.id} category={c} />
          ))}
        </div>
      </section>

      <CarOnboarding />

      {/* Если у пользователя есть primary авто — секция совместимых товаров */}
      <MyCarProducts />

      <section>
        <SectionHeader title="Товары сезона" href="/c/tires-and-wheels" />
        <HorizontalProducts products={seasonProducts.data} />
      </section>

      {secondary ? (
        <div className="px-4 md:px-0">
          <SecondaryBanner banner={secondary} />
        </div>
      ) : null}

      <VinSearch />

      <section>
        <SectionHeader title="Товары для ТО" href="/c/fluids" />
        <HorizontalProducts products={maintenance.data} />
      </section>

      <section>
        <SectionHeader title="Кузовные детали" href="/c/body-parts" />
        <HorizontalProducts products={body.data} />
      </section>

      <section>
        <SectionHeader title="Аксессуары" href="/c/accessories" />
        <HorizontalProducts products={accessories.data} />
      </section>

      <section>
        <SectionHeader title="Автокосметика" href="/c/consumables" />
        <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4 md:px-0">
          {cosmetics.data.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Автоэлектроника" href="/c/electrical" />
        <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4 md:px-0">
          {electronics.data.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="pb-2">
        <SectionHeader title="Бренды" href="/brands" />
        <BrandsCarousel brands={brands} />
      </section>
    </div>
  );
}
