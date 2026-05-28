// Domkrat seed script.
// Запуск: pnpm db:seed   (или из apps/api: pnpm exec prisma db seed)
//
// Идемпотентен через upsert. Все ID — детерминированные UUID v4 константы.
// Пароль для всех тестовых пользователей: "Test1234!"

import {
  AttributeDataType,
  CellType,
  ContractStatus,
  ContractType,
  DeliveryMethodType,
  DocumentStatus,
  DocumentType,
  FaqStatus,
  FuelType,
  Gender,
  LegalType,
  MerchantStatus,
  MerchantType,
  NotificationChannel,
  PrismaClient,
  ProductStatus,
  SubscriptionPlan,
  Transmission,
  UserRole,
  VerificationStatus,
  WarehouseType,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

const ml = (ru: string, uz: string) => ({ ru, uz });

const TEST_PASSWORD = 'Test1234!';

// Детерминированные UUID — чтобы можно было ссылаться в тестах и повторных запусках
const ID = {
  user: {
    superAdmin: '00000000-0000-4000-8000-000000000001',
    admin1: '00000000-0000-4000-8000-000000000002',
    admin2: '00000000-0000-4000-8000-000000000003',
    customer1: '00000000-0000-4000-8000-000000000010',
    customer2: '00000000-0000-4000-8000-000000000011',
    customer3: '00000000-0000-4000-8000-000000000012',
    merchant1Owner: '00000000-0000-4000-8000-000000000020',
    merchant2Owner: '00000000-0000-4000-8000-000000000021',
    courier1: '00000000-0000-4000-8000-000000000030',
    contentManager: '00000000-0000-4000-8000-000000000040',
    financeManager: '00000000-0000-4000-8000-000000000041',
    warehouseWorker: '00000000-0000-4000-8000-000000000042',
  },
  merchant: {
    type1: '10000000-0000-4000-8000-000000000001', // BoschPart UZ — FBO
    type2: '10000000-0000-4000-8000-000000000002', // AvtoZapchasti — FBS
  },
  warehouse: {
    main: '20000000-0000-4000-8000-000000000001',
  },
};

async function main(): Promise<void> {
  console.log('[seed] starting…');
  const passwordHash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });

  await seedUsers(passwordHash);
  await seedMerchants();
  await seedCategoriesAndBrands();
  await seedCars();
  await seedProducts();
  await seedWarehouse();
  await seedInventory();
  await seedDeliveryMethods();
  await seedNotificationTemplates();
  await seedSettingsAndFaq();
  await seedBanners();

  console.log('[seed] done ✓');
}

// ---------------------------------------------------------------------------
async function seedBanners(): Promise<void> {
  const banners = [
    {
      id: 'b0000000-0000-4000-8000-000000000001',
      position: 'HOME_MAIN' as const,
      title: ml('Bridgestone Blizzak −30%', 'Bridgestone Blizzak −30%'),
      subtitle: ml('Полный комплект от 2 940 000 сум', 'To\'plam 2 940 000 so\'mdan'),
      imageUrlDesktop: '/banners/bridgestone-hero.svg',
      linkUrl: '/c/tires-and-wheels',
      sortOrder: 0,
    },
    {
      id: 'b0000000-0000-4000-8000-000000000002',
      position: 'HOME_SECONDARY' as const,
      title: ml('Шины зимние Bridgestone Blizzak', 'Qishki shinalar Bridgestone Blizzak'),
      subtitle: ml('Закажите через VIN-поиск или каталог', 'VIN-qidiruv yoki katalog orqali buyurtma bering'),
      imageUrlDesktop: '/banners/bridgestone-secondary.svg',
      linkUrl: '/c/tires-and-wheels/winter-tires',
      sortOrder: 0,
    },
  ];
  for (const b of banners) {
    await prisma.banner.upsert({
      where: { id: b.id },
      update: {
        title: b.title,
        subtitle: b.subtitle,
        imageUrlDesktop: b.imageUrlDesktop,
        linkUrl: b.linkUrl,
        position: b.position,
        sortOrder: b.sortOrder,
        isActive: true,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2027-12-31'),
      },
      create: {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrlDesktop: b.imageUrlDesktop,
        linkUrl: b.linkUrl,
        position: b.position,
        sortOrder: b.sortOrder,
        isActive: true,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2027-12-31'),
      },
    });
  }
  console.log(`  • banners: ${banners.length}`);
}

// ---------------------------------------------------------------------------
async function seedUsers(passwordHash: string): Promise<void> {
  const users: Array<{
    id: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    roles: UserRole[];
    isPhoneVerified?: boolean;
    isEmailVerified?: boolean;
  }> = [
    {
      id: ID.user.superAdmin,
      email: 'super@domkrat.uz',
      phone: '+998900000001',
      firstName: 'Super',
      lastName: 'Admin',
      roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    },
    {
      id: ID.user.admin1,
      email: 'admin1@domkrat.uz',
      phone: '+998900000002',
      firstName: 'Ольга',
      lastName: 'Каримова',
      roles: [UserRole.ADMIN, UserRole.FINANCE_MANAGER],
    },
    {
      id: ID.user.admin2,
      email: 'admin2@domkrat.uz',
      phone: '+998900000003',
      firstName: 'Дилшод',
      lastName: 'Юсупов',
      roles: [UserRole.ADMIN, UserRole.CONTENT_MANAGER],
    },
    {
      id: ID.user.customer1,
      email: 'customer1@example.com',
      phone: '+998901111111',
      firstName: 'Иван',
      lastName: 'Петров',
      roles: [UserRole.CUSTOMER],
    },
    {
      id: ID.user.customer2,
      email: 'customer2@example.com',
      phone: '+998901111112',
      firstName: 'Aziza',
      lastName: 'Karimova',
      roles: [UserRole.CUSTOMER],
    },
    {
      id: ID.user.customer3,
      email: 'customer3@example.com',
      phone: '+998901111113',
      firstName: 'Sherzod',
      lastName: 'Tursunov',
      roles: [UserRole.CUSTOMER],
    },
    {
      id: ID.user.merchant1Owner,
      email: 'merchant1@example.com',
      phone: '+998902222221',
      firstName: 'BoschPart',
      lastName: 'Owner',
      roles: [UserRole.MERCHANT],
    },
    {
      id: ID.user.merchant2Owner,
      email: 'merchant2@example.com',
      phone: '+998902222222',
      firstName: 'AvtoZapchasti',
      lastName: 'Owner',
      roles: [UserRole.MERCHANT],
    },
    {
      id: ID.user.courier1,
      email: 'courier1@domkrat.uz',
      phone: '+998903333331',
      firstName: 'Бекзод',
      lastName: 'Юлдашев',
      roles: [UserRole.COURIER],
    },
    {
      id: ID.user.contentManager,
      email: 'content@domkrat.uz',
      phone: '+998904444441',
      firstName: 'Малика',
      lastName: 'Ходжаева',
      roles: [UserRole.CONTENT_MANAGER],
    },
    {
      id: ID.user.financeManager,
      email: 'finance@domkrat.uz',
      phone: '+998904444442',
      firstName: 'Анвар',
      lastName: 'Рустамов',
      roles: [UserRole.FINANCE_MANAGER],
    },
    {
      id: ID.user.warehouseWorker,
      email: 'warehouse@domkrat.uz',
      phone: '+998904444443',
      firstName: 'Жасур',
      lastName: 'Кадыров',
      roles: [UserRole.WAREHOUSE_WORKER],
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        email: u.email,
        phone: u.phone,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        isEmailVerified: u.isEmailVerified ?? true,
        isPhoneVerified: u.isPhoneVerified ?? true,
        gender: Gender.MALE,
        preferredLanguage: 'ru',
      },
    });
    // Привязываем merchantId для ролей MERCHANT/MERCHANT_STAFF
    const merchantIdForUser =
      u.id === ID.user.merchant1Owner ? ID.merchant.type1 :
      u.id === ID.user.merchant2Owner ? ID.merchant.type2 :
      null;

    for (const role of u.roles) {
      const isMerchantRole = role === UserRole.MERCHANT || role === UserRole.MERCHANT_STAFF;
      const merchantId = isMerchantRole ? merchantIdForUser : null;
      // Compound unique включает nullable merchantId — в PostgreSQL NULL не считается
      // уникальным, потому используем findFirst + create вместо upsert.
      const existing = await prisma.userRoleAssignment.findFirst({
        where: { userId: u.id, role, merchantId },
      });
      if (!existing) {
        await prisma.userRoleAssignment.create({
          data: { userId: u.id, role, merchantId: merchantId ?? undefined },
        });
      }
    }
  }

  // Адреса для customer1
  await prisma.userAddress.upsert({
    where: { id: '30000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '30000000-0000-4000-8000-000000000001',
      userId: ID.user.customer1,
      title: 'Дом',
      recipientName: 'Иван Петров',
      recipientPhone: '+998901111111',
      region: 'Ташкент',
      city: 'Ташкент',
      district: 'Юнусабад',
      addressLine: 'ул. Амира Темура, 15, кв. 42',
      isDefault: true,
    },
  });

  console.log(`  • users: ${users.length}, addresses: 1`);
}

// ---------------------------------------------------------------------------
async function seedMerchants(): Promise<void> {
  // Merchant 1 — Type 1 (FBO, склад платформы)
  await prisma.merchant.upsert({
    where: { id: ID.merchant.type1 },
    update: {},
    create: {
      id: ID.merchant.type1,
      userId: ID.user.merchant1Owner,
      merchantType: MerchantType.TYPE_1,
      legalType: LegalType.LLC,
      legalName: 'ООО «БошПарт»',
      brandName: 'BoschPart UZ',
      slug: 'boschpart-uz',
      description: ml('Запчасти Bosch, Mann, Mahle — оригинал и аналоги.', 'Bosch, Mann, Mahle ehtiyot qismlari — original va analog.'),
      taxId: '301234567',
      registrationNumber: 'REG-1001',
      bankAccount: '20208000000000000001',
      bankName: 'Узпромстройбанк',
      bankMfo: '00440',
      legalAddress: 'г. Ташкент, ул. Узбекистанская, 10',
      actualAddress: 'г. Ташкент, ул. Узбекистанская, 10',
      contactEmail: 'contact@boschpart.uz',
      contactPhone: '+998712001001',
      status: MerchantStatus.ACTIVE,
      verificationStatus: VerificationStatus.APPROVED,
      verifiedAt: new Date(),
      commissionRate: new Prisma.Decimal('10.00'),
      isActive: true,
    },
  });

  // Merchant 2 — Type 2 (FBS, свой склад)
  await prisma.merchant.upsert({
    where: { id: ID.merchant.type2 },
    update: {},
    create: {
      id: ID.merchant.type2,
      userId: ID.user.merchant2Owner,
      merchantType: MerchantType.TYPE_2,
      legalType: LegalType.IE,
      legalName: 'ИП Каримов А.А.',
      brandName: 'AvtoZapchasti',
      slug: 'avtozapchasti',
      description: ml('Шины, диски, аккумуляторы. Доставка по Ташкенту.', 'Shinalar, disklar, akkumulyatorlar. Toshkent bo\'ylab yetkazib berish.'),
      taxId: '512345678',
      registrationNumber: 'IE-2002',
      bankAccount: '20208000000000000002',
      bankName: 'Капиталбанк',
      bankMfo: '00845',
      legalAddress: 'г. Ташкент, ул. Бабура, 25',
      actualAddress: 'г. Ташкент, ул. Бабура, 25',
      contactEmail: 'info@avtozapchasti.uz',
      contactPhone: '+998712002002',
      status: MerchantStatus.ACTIVE,
      verificationStatus: VerificationStatus.APPROVED,
      verifiedAt: new Date(),
      commissionRate: new Prisma.Decimal('12.00'),
      isActive: true,
    },
  });

  // MerchantBalance для обоих
  for (const merchantId of [ID.merchant.type1, ID.merchant.type2]) {
    await prisma.merchantBalance.upsert({
      where: { merchantId },
      update: {},
      create: { merchantId, availableBalance: new Prisma.Decimal('0') },
    });
  }

  // Контракты
  await prisma.merchantContract.upsert({
    where: { contractNumber: 'CT-2026-0001' },
    update: {},
    create: {
      contractNumber: 'CT-2026-0001',
      merchantId: ID.merchant.type1,
      contractType: ContractType.TYPE_1,
      commissionRate: new Prisma.Decimal('10.00'),
      rentalRatePerMonth: new Prisma.Decimal('50000'),
      subscriptionPlan: SubscriptionPlan.BASIC,
      subscriptionPrice: new Prisma.Decimal('0'),
      signedAt: new Date('2026-01-15'),
      validFrom: new Date('2026-01-15'),
      status: ContractStatus.ACTIVE,
    },
  });
  await prisma.merchantContract.upsert({
    where: { contractNumber: 'CT-2026-0002' },
    update: {},
    create: {
      contractNumber: 'CT-2026-0002',
      merchantId: ID.merchant.type2,
      contractType: ContractType.TYPE_2,
      commissionRate: new Prisma.Decimal('12.00'),
      subscriptionPlan: SubscriptionPlan.NONE,
      signedAt: new Date('2026-02-01'),
      validFrom: new Date('2026-02-01'),
      status: ContractStatus.ACTIVE,
    },
  });

  console.log('  • merchants: 2, contracts: 2, balances: 2');
}

// ---------------------------------------------------------------------------
async function seedCategoriesAndBrands(): Promise<void> {
  // Категории (parent + children). iconUrl = публичные ассеты apps/web/public/categories/*.svg
  const rootCategories = [
    { slug: 'fluids', name: ml('Моторные масла', 'Motor yog\'lari'), iconUrl: '/categories/oil.svg' },
    { slug: 'tires-and-wheels', name: ml('Шины и диски', 'Shinalar va disklar'), iconUrl: '/categories/tire.svg' },
    { slug: 'body-parts', name: ml('Кузовные', 'Korpus'), iconUrl: '/categories/body.svg' },
    { slug: 'interior', name: ml('Салон и чехлы', 'Salon va g\'iloflar'), iconUrl: '/categories/seat.svg' },
    { slug: 'consumables', name: ml('Расходники', 'Sarflanadigan'), iconUrl: '/categories/filter.svg' },
    { slug: 'brake-system', name: ml('Тормозная система', 'Tormoz tizimi'), iconUrl: '/categories/brake.svg' },
    { slug: 'engine-parts', name: ml('Двигатель', 'Dvigatel'), iconUrl: '/categories/engine.svg' },
    { slug: 'electrical', name: ml('Электрика', 'Elektrika'), iconUrl: '/categories/battery.svg' },
    { slug: 'suspension', name: ml('Подвеска и рулевое', 'Osma va rulli'), iconUrl: '/categories/suspension.svg' },
    { slug: 'accessories', name: ml('Аксессуары', 'Aksessuarlar'), iconUrl: '/categories/accessory.svg' },
  ];

  for (let i = 0; i < rootCategories.length; i++) {
    const cat = rootCategories[i]!;
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, iconUrl: cat.iconUrl, position: i },
      create: { slug: cat.slug, name: cat.name, iconUrl: cat.iconUrl, position: i, level: 0 },
    });
  }

  // Несколько подкатегорий для "Шины и диски"
  const tires = await prisma.category.findUnique({ where: { slug: 'tires-and-wheels' } });
  if (tires) {
    for (const sub of [
      { slug: 'summer-tires', name: ml('Летние шины', 'Yozgi shinalar') },
      { slug: 'winter-tires', name: ml('Зимние шины', 'Qishki shinalar') },
      { slug: 'all-season-tires', name: ml('Всесезонные шины', 'Hamma fasl shinalar') },
      { slug: 'alloy-wheels', name: ml('Литые диски', 'Quyma disklar') },
    ]) {
      await prisma.category.upsert({
        where: { slug: sub.slug },
        update: {},
        create: { ...sub, parentId: tires.id, level: 1 },
      });
    }
  }

  // Бренды (порядок position определяет позицию в карусели брендов)
  const brands: Array<{ name: string; logoUrl?: string }> = [
    { name: 'Toyota', logoUrl: '/brands/toyota.svg' },
    { name: 'Hyundai', logoUrl: '/brands/hyundai.svg' },
    { name: 'KIA', logoUrl: '/brands/kia.svg' },
    { name: 'Chevrolet', logoUrl: '/brands/chevrolet.svg' },
    { name: 'Lexus', logoUrl: '/brands/lexus.svg' },
    { name: 'UAZ', logoUrl: '/brands/uaz.svg' },
    { name: 'Lada', logoUrl: '/brands/lada.svg' },
    { name: 'BMW', logoUrl: '/brands/bmw.svg' },
    { name: 'Bosch', logoUrl: '/brands/bosch.svg' },
    { name: 'Mann' },
    { name: 'Mahle' },
    { name: 'Denso' },
    { name: 'NGK' },
    { name: 'Brembo' },
    { name: 'Continental' },
    { name: 'Castrol' },
    { name: 'Mobil 1' },
    { name: 'Knecht' },
  ];
  for (let i = 0; i < brands.length; i++) {
    const b = brands[i]!;
    await prisma.brand.upsert({
      where: { name: b.name },
      update: { position: i, logoUrl: b.logoUrl, isActive: true },
      create: {
        name: b.name,
        slug: b.name.toLowerCase().replace(/\s+/g, '-'),
        isActive: true,
        position: i,
        logoUrl: b.logoUrl,
      },
    });
  }

  console.log(`  • categories: ${rootCategories.length} + 4 sub, brands: ${brands.length}`);
}

// ---------------------------------------------------------------------------
async function seedCars(): Promise<void> {
  // Популярные марки в Узбекистане
  const makes = [
    { name: 'Chevrolet', slug: 'chevrolet', isPopular: true, countryOfOrigin: 'USA' },
    { name: 'Daewoo', slug: 'daewoo', isPopular: true, countryOfOrigin: 'South Korea' },
    { name: 'Toyota', slug: 'toyota', isPopular: true, countryOfOrigin: 'Japan' },
    { name: 'Hyundai', slug: 'hyundai', isPopular: true, countryOfOrigin: 'South Korea' },
    { name: 'KIA', slug: 'kia', isPopular: true, countryOfOrigin: 'South Korea' },
    { name: 'Lada', slug: 'lada', isPopular: true, countryOfOrigin: 'Russia' },
    { name: 'Nissan', slug: 'nissan', isPopular: true, countryOfOrigin: 'Japan' },
    { name: 'BMW', slug: 'bmw', isPopular: false, countryOfOrigin: 'Germany' },
    { name: 'Mercedes-Benz', slug: 'mercedes-benz', isPopular: false, countryOfOrigin: 'Germany' },
    { name: 'Volkswagen', slug: 'volkswagen', isPopular: false, countryOfOrigin: 'Germany' },
    { name: 'Mitsubishi', slug: 'mitsubishi', isPopular: false, countryOfOrigin: 'Japan' },
    { name: 'Honda', slug: 'honda', isPopular: false, countryOfOrigin: 'Japan' },
    { name: 'Ford', slug: 'ford', isPopular: false, countryOfOrigin: 'USA' },
    { name: 'Mazda', slug: 'mazda', isPopular: false, countryOfOrigin: 'Japan' },
    { name: 'Suzuki', slug: 'suzuki', isPopular: false, countryOfOrigin: 'Japan' },
    { name: 'Subaru', slug: 'subaru', isPopular: false, countryOfOrigin: 'Japan' },
    { name: 'Ravon', slug: 'ravon', isPopular: true, countryOfOrigin: 'Uzbekistan' },
    { name: 'GAZ', slug: 'gaz', isPopular: false, countryOfOrigin: 'Russia' },
    { name: 'UAZ', slug: 'uaz', isPopular: false, countryOfOrigin: 'Russia' },
    { name: 'Renault', slug: 'renault', isPopular: false, countryOfOrigin: 'France' },
  ];

  for (let i = 0; i < makes.length; i++) {
    const make = makes[i]!;
    await prisma.carMake.upsert({
      where: { slug: make.slug },
      update: {},
      create: { ...make, position: i },
    });
  }

  // Несколько моделей для популярных марок
  const modelsByMake: Record<string, Array<{ name: string; slug: string }>> = {
    chevrolet: [
      { name: 'Lacetti', slug: 'lacetti' },
      { name: 'Cobalt', slug: 'cobalt' },
      { name: 'Nexia 3', slug: 'nexia-3' },
      { name: 'Spark', slug: 'spark' },
      { name: 'Captiva', slug: 'captiva' },
    ],
    daewoo: [
      { name: 'Nexia', slug: 'nexia' },
      { name: 'Matiz', slug: 'matiz' },
      { name: 'Damas', slug: 'damas' },
    ],
    toyota: [
      { name: 'Camry', slug: 'camry' },
      { name: 'Corolla', slug: 'corolla' },
      { name: 'RAV4', slug: 'rav4' },
      { name: 'Land Cruiser', slug: 'land-cruiser' },
    ],
    hyundai: [
      { name: 'Sonata', slug: 'sonata' },
      { name: 'Elantra', slug: 'elantra' },
      { name: 'Tucson', slug: 'tucson' },
    ],
    kia: [
      { name: 'Optima', slug: 'optima' },
      { name: 'Cerato', slug: 'cerato' },
      { name: 'Sportage', slug: 'sportage' },
    ],
    lada: [
      { name: 'Granta', slug: 'granta' },
      { name: 'Vesta', slug: 'vesta' },
      { name: 'Largus', slug: 'largus' },
    ],
  };

  let modelCount = 0;
  for (const [makeSlug, models] of Object.entries(modelsByMake)) {
    const make = await prisma.carMake.findUnique({ where: { slug: makeSlug } });
    if (!make) continue;
    for (const m of models) {
      await prisma.carModel.upsert({
        where: { makeId_slug: { makeId: make.id, slug: m.slug } },
        update: {},
        create: { makeId: make.id, name: m.name, slug: m.slug, isActive: true },
      });
      modelCount++;
    }
  }

  // Одна generation для Toyota Camry для демо compatibility
  const camry = await prisma.carModel.findFirst({
    where: { slug: 'camry', make: { slug: 'toyota' } },
  });
  if (camry) {
    const gen = await prisma.carGeneration.upsert({
      where: { id: '40000000-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: '40000000-0000-4000-8000-000000000001',
        modelId: camry.id,
        name: 'VII (XV40)',
        yearFrom: 2006,
        yearTo: 2011,
      },
    });

    const engine = await prisma.carEngine.upsert({
      where: { code: '2AZ-FE' },
      update: {},
      create: {
        code: '2AZ-FE',
        name: '2AZ-FE 2.4',
        displacement: new Prisma.Decimal('2.4'),
        cylinders: 4,
        powerHp: 167,
        fuelType: FuelType.PETROL,
        manufacturer: 'Toyota',
      },
    });

    await prisma.carModification.upsert({
      where: { id: '40000000-0000-4000-8000-000000000010' },
      update: {},
      create: {
        id: '40000000-0000-4000-8000-000000000010',
        generationId: gen.id,
        engineId: engine.id,
        name: '2.4 AT (167 л.с.)',
        transmission: Transmission.AUTOMATIC,
        horsepower: 167,
        fuelType: FuelType.PETROL,
      },
    });
  }

  console.log(`  • car makes: ${makes.length}, models: ${modelCount}, +1 generation +1 modification`);
}

// ---------------------------------------------------------------------------
async function seedProducts(): Promise<void> {
  // Категории
  const cats = await prisma.category.findMany({
    where: { slug: { in: ['fluids', 'tires-and-wheels', 'body-parts', 'interior', 'consumables', 'brake-system', 'engine-parts', 'electrical', 'suspension', 'accessories'] } },
    select: { id: true, slug: true },
  });
  const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id])) as Record<string, string>;
  for (const slug of ['fluids', 'tires-and-wheels', 'body-parts', 'interior', 'consumables', 'brake-system', 'engine-parts', 'electrical', 'suspension', 'accessories']) {
    if (!catBySlug[slug]) throw new Error(`Category ${slug} not seeded`);
  }

  // Бренды (берём по name; не падаем если бренда нет — оставим brandId=null)
  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const brandByName = Object.fromEntries(brands.map((b) => [b.name, b.id])) as Record<string, string>;
  const B = (n: string): string | undefined => brandByName[n];

  type ProductSeed = {
    slug: string;
    sku: string;
    nameRu: string;
    nameUz: string;
    categoryId: string;
    brandId?: string;
    merchantId: string;
    oemNumber?: string;
    price: string;
    compareAtPrice?: string;
    weight?: string;
    isFeatured?: boolean;
    isOnSale?: boolean;
    isNew?: boolean;
  };

  const M1 = ID.merchant.type1;
  const M2 = ID.merchant.type2;

  const products: ProductSeed[] = [
    // =========================================================================
    // FLUIDS — Моторные масла, антифризы, тормозная жидкость (10 шт)
    // =========================================================================
    { slug: 'engine-oil-shell-helix-ultra-5w40-4l', sku: 'SHELL-HELIX-5W40-4L', nameRu: 'Масло моторное Shell Helix Ultra 5W-40, 4 л', nameUz: 'Motor moyi Shell Helix Ultra 5W-40, 4 l', categoryId: catBySlug['fluids']!, brandId: B('Castrol'), merchantId: M1, price: '420000', compareAtPrice: '480000', weight: '3.700', isFeatured: true, isOnSale: true },
    { slug: 'engine-oil-mobil1-esp-5w30-4l', sku: 'MOBIL1-ESP-5W30-4L', nameRu: 'Масло моторное Mobil 1 ESP 5W-30 синтетическое, 4 л', nameUz: 'Mobil 1 ESP 5W-30 sintetik motor moyi, 4 l', categoryId: catBySlug['fluids']!, brandId: B('Mobil 1'), merchantId: M2, price: '480000', weight: '3.700', isNew: true },
    { slug: 'engine-oil-castrol-magnatec-5w40-4l', sku: 'CASTROL-MAG-5W40-4L', nameRu: 'Масло моторное Castrol Magnatec 5W-40, 4 л', nameUz: 'Castrol Magnatec 5W-40 motor moyi, 4 l', categoryId: catBySlug['fluids']!, brandId: B('Castrol'), merchantId: M1, price: '380000', weight: '3.700' },
    { slug: 'engine-oil-liqui-moly-top-tec-4200-5w30-4l', sku: 'LM-TT4200-5W30', nameRu: 'Масло моторное Liqui Moly Top Tec 4200 5W-30, 4 л', nameUz: 'Liqui Moly Top Tec 4200 5W-30 moy, 4 l', categoryId: catBySlug['fluids']!, brandId: B('Mahle'), merchantId: M2, price: '520000', compareAtPrice: '580000', weight: '3.700', isOnSale: true },
    { slug: 'engine-oil-zic-x9-5w40-4l', sku: 'ZIC-X9-5W40-4L', nameRu: 'Масло моторное ZIC X9 5W-40 синтетическое, 4 л', nameUz: 'ZIC X9 5W-40 sintetik motor moyi, 4 l', categoryId: catBySlug['fluids']!, brandId: B('Denso'), merchantId: M1, price: '310000', weight: '3.700' },
    { slug: 'engine-oil-lukoil-genesis-5w30-4l', sku: 'LUKOIL-GEN-5W30-4L', nameRu: 'Масло моторное Лукойл Genesis 5W-30, 4 л', nameUz: 'Lukoil Genesis 5W-30 motor moyi, 4 l', categoryId: catBySlug['fluids']!, brandId: B('Castrol'), merchantId: M2, price: '245000', weight: '3.700' },
    { slug: 'gearbox-oil-atf-type-iv-1l', sku: 'ATF-TYPE-IV-1L', nameRu: 'Масло трансмиссионное АКПП ATF Type IV, 1 л', nameUz: 'Avtomat uzatma yog\'i ATF Type IV, 1 l', categoryId: catBySlug['fluids']!, brandId: B('Castrol'), merchantId: M1, price: '95000', weight: '0.900' },
    { slug: 'antifreeze-felix-g12-5l', sku: 'FELIX-G12-5L', nameRu: 'Антифриз Felix Carbox G12+ красный, 5 л', nameUz: 'Felix Carbox G12+ qizil antifriz, 5 l', categoryId: catBySlug['fluids']!, brandId: B('Bosch'), merchantId: M2, price: '125000', compareAtPrice: '150000', weight: '5.200', isOnSale: true },
    { slug: 'coolant-tosol-a40m-10l', sku: 'TOSOL-A40M-10L', nameRu: 'Охлаждающая жидкость Тосол А-40М, 10 л', nameUz: 'Tosol A-40M sovutkich suyuqligi, 10 l', categoryId: catBySlug['fluids']!, brandId: B('Bosch'), merchantId: M1, price: '85000', weight: '10.500' },
    { slug: 'brake-fluid-dot4-1l', sku: 'DOT4-1L', nameRu: 'Тормозная жидкость DOT-4, 1 л', nameUz: 'DOT-4 tormoz suyuqligi, 1 l', categoryId: catBySlug['fluids']!, brandId: B('Brembo'), merchantId: M2, price: '45000', weight: '1.100', isFeatured: true },

    // =========================================================================
    // TIRES & WHEELS — Шины и диски (10 шт)
    // =========================================================================
    { slug: 'tire-bridgestone-blizzak-185-65-r15', sku: 'BRIDGESTONE-BLIZZAK-185-65-R15', nameRu: 'Шины зимние Bridgestone Blizzak 185/65 R15', nameUz: 'Bridgestone Blizzak qishki shinalar 185/65 R15', categoryId: catBySlug['tires-and-wheels']!, brandId: B('Continental'), merchantId: M1, price: '735000', compareAtPrice: '1050000', weight: '7.500', isFeatured: true, isOnSale: true },
    { slug: 'tire-michelin-pilot-sport-205-55-r16', sku: 'MICHELIN-PS4-205-55-R16', nameRu: 'Шины летние Michelin Pilot Sport 4 205/55 R16', nameUz: 'Michelin Pilot Sport 4 yozgi shinalar 205/55 R16', categoryId: catBySlug['tires-and-wheels']!, brandId: B('Continental'), merchantId: M2, price: '890000', weight: '9.000', isFeatured: true },
    { slug: 'tire-continental-205-55-r16', sku: 'CONTI-205-55-R16', nameRu: 'Шина Continental ContiPremiumContact 5 205/55 R16', nameUz: 'Continental ContiPremiumContact 5 205/55 R16', categoryId: catBySlug['tires-and-wheels']!, brandId: B('Continental'), merchantId: M2, price: '950000', weight: '9.500' },
    { slug: 'tire-yokohama-bluearth-195-65-r15', sku: 'YOKO-BE-195-65-R15', nameRu: 'Шины летние Yokohama BluEarth-GT AE51 195/65 R15', nameUz: 'Yokohama BluEarth-GT AE51 195/65 R15', categoryId: catBySlug['tires-and-wheels']!, brandId: B('Continental'), merchantId: M1, price: '680000', weight: '8.000', isNew: true },
    { slug: 'tire-hankook-winter-205-55-r16', sku: 'HANKOOK-W-205-55-R16', nameRu: 'Шины зимние Hankook Winter i*cept RS3 205/55 R16', nameUz: 'Hankook Winter i*cept RS3 qishki shinalar 205/55 R16', categoryId: catBySlug['tires-and-wheels']!, brandId: B('Continental'), merchantId: M2, price: '720000', compareAtPrice: '850000', weight: '9.000', isOnSale: true },
    { slug: 'tire-nokian-hakkapeliitta-215-65-r16', sku: 'NOKIAN-HKP-215-65-R16', nameRu: 'Шины зимние Nokian Hakkapeliitta R3 SUV 215/65 R16', nameUz: 'Nokian Hakkapeliitta R3 SUV 215/65 R16', categoryId: catBySlug['tires-and-wheels']!, brandId: B('Continental'), merchantId: M1, price: '1180000', weight: '11.000' },
    { slug: 'alloy-wheel-replica-r16-toyota-camry', sku: 'WHEEL-REPL-R16-CAMRY', nameRu: 'Литой диск Replica TY15 16x6.5 5x114.3 ET45 для Toyota', nameUz: 'Replica TY15 16x6.5 5x114.3 ET45 quyma disk', categoryId: catBySlug['tires-and-wheels']!, merchantId: M2, price: '485000', weight: '8.500' },
    { slug: 'hubcap-r15-vaz', sku: 'HUBCAP-R15-VAZ', nameRu: 'Колпак колеса R15 для ВАЗ универсальный, 4 шт.', nameUz: 'VAZ uchun R15 g\'ildirak qopqog\'i, 4 dona', categoryId: catBySlug['tires-and-wheels']!, brandId: B('Lada'), merchantId: M1, price: '95000', weight: '2.000' },
    { slug: 'wheel-bolts-m12x1-5-20', sku: 'BOLTS-M12-1.5-20', nameRu: 'Болты колёсные М12х1.5х30, конус, комплект 20 шт.', nameUz: 'G\'ildirak boltlari M12x1.5x30, konus, 20 dona', categoryId: catBySlug['tires-and-wheels']!, brandId: B('Bosch'), merchantId: M2, price: '85000', weight: '1.500' },
    { slug: 'tpms-sensor-433', sku: 'TPMS-433-4', nameRu: 'Датчики давления шин TPMS 433MHz, комплект 4 шт.', nameUz: 'TPMS 433MHz shina bosim datchiklari, 4 dona', categoryId: catBySlug['tires-and-wheels']!, brandId: B('Continental'), merchantId: M1, price: '320000', weight: '0.400', isNew: true },

    // =========================================================================
    // BODY-PARTS — Кузовные (10 шт)
    // =========================================================================
    { slug: 'headlight-led-camry-2019-2024', sku: 'LED-CAMRY-19-24', nameRu: 'Фара передняя левая LED для Toyota Camry XV70 2019—2024', nameUz: 'Toyota Camry XV70 2019—2024 uchun chap LED faraTo', categoryId: catBySlug['body-parts']!, brandId: B('Toyota'), merchantId: M1, price: '1240000', compareAtPrice: '1480000', weight: '3.000', isOnSale: true, isFeatured: true },
    { slug: 'bumper-front-nexia3', sku: 'BUMPER-NEX3-FR', nameRu: 'Бампер передний Chevrolet Nexia 3 (без отверстий)', nameUz: 'Chevrolet Nexia 3 old bamperi', categoryId: catBySlug['body-parts']!, brandId: B('Chevrolet'), merchantId: M2, price: '385000', weight: '5.000' },
    { slug: 'hood-cobalt', sku: 'HOOD-COBALT', nameRu: 'Капот Chevrolet Cobalt 2013-2020 (грунтованный)', nameUz: 'Chevrolet Cobalt 2013-2020 kapoti', categoryId: catBySlug['body-parts']!, brandId: B('Chevrolet'), merchantId: M1, price: '920000', compareAtPrice: '1100000', weight: '14.000', isOnSale: true },
    { slug: 'fender-front-right-spark', sku: 'FENDER-SPARK-FR', nameRu: 'Крыло переднее правое Chevrolet Spark M300', nameUz: 'Chevrolet Spark M300 o\'ng old qanot', categoryId: catBySlug['body-parts']!, brandId: B('Chevrolet'), merchantId: M2, price: '285000', weight: '4.500' },
    { slug: 'mirror-side-left-lacetti', sku: 'MIRROR-LACETTI-L', nameRu: 'Зеркало боковое левое электр. Chevrolet Lacetti', nameUz: 'Chevrolet Lacetti chap elektr ko\'zgu', categoryId: catBySlug['body-parts']!, brandId: B('Chevrolet'), merchantId: M1, price: '195000', weight: '0.800' },
    { slug: 'grille-radiator-nexia3', sku: 'GRILLE-NEX3', nameRu: 'Решётка радиатора Chevrolet Nexia 3 хром', nameUz: 'Chevrolet Nexia 3 xrom radiator panjarasi', categoryId: catBySlug['body-parts']!, brandId: B('Chevrolet'), merchantId: M2, price: '125000', weight: '0.900', isFeatured: true },
    { slug: 'windshield-laminated-camry-xv50', sku: 'WS-CAMRY-XV50', nameRu: 'Стекло лобовое триплекс Toyota Camry XV50 2011-2017', nameUz: 'Toyota Camry XV50 2011-2017 old triplex oynasi', categoryId: catBySlug['body-parts']!, brandId: B('Toyota'), merchantId: M1, price: '1850000', weight: '18.000' },
    { slug: 'door-moulding-universal', sku: 'MOULDING-UNI-4', nameRu: 'Молдинги дверей универсальные хром, комплект 4 шт.', nameUz: 'Eshik xrom moldinglari, 4 dona', categoryId: catBySlug['body-parts']!, merchantId: M2, price: '65000', weight: '0.500' },
    { slug: 'sill-trim-camry', sku: 'SILL-CAMRY', nameRu: 'Накладки на пороги Toyota Camry с подсветкой 4 шт.', nameUz: 'Toyota Camry yorug\'lik bilan porog qoplamalari, 4 dona', categoryId: catBySlug['body-parts']!, brandId: B('Toyota'), merchantId: M1, price: '180000', compareAtPrice: '220000', weight: '0.800', isOnSale: true },
    { slug: 'rear-light-tail-cobalt', sku: 'TAIL-COBALT-R', nameRu: 'Фонарь задний правый Chevrolet Cobalt', nameUz: 'Chevrolet Cobalt o\'ng orqa chiroq', categoryId: catBySlug['body-parts']!, brandId: B('Chevrolet'), merchantId: M2, price: '215000', weight: '1.200' },

    // =========================================================================
    // INTERIOR — Салон, чехлы, аксессуары салона (10 шт)
    // =========================================================================
    { slug: 'seat-covers-universal-4', sku: 'COVERS-UNI-4', nameRu: 'Чехлы автомобильные универсальные текстильные, комплект 4 шт.', nameUz: 'Universal mato chexollari, 4 dona', categoryId: catBySlug['interior']!, brandId: B('Bosch'), merchantId: M2, price: '185000', weight: '1.800', isFeatured: true },
    { slug: 'seat-covers-camry-eco-leather', sku: 'COVERS-CAMRY-ECO', nameRu: 'Чехлы экокожа модельные для Toyota Camry, комплект', nameUz: 'Toyota Camry uchun ekokoja chexollari, to\'plam', categoryId: catBySlug['interior']!, brandId: B('Toyota'), merchantId: M1, price: '780000', compareAtPrice: '950000', weight: '4.500', isOnSale: true, isFeatured: true },
    { slug: 'seat-pad-massage', sku: 'PAD-MASSAGE', nameRu: 'Накидка на сиденье массажная с подогревом 12V', nameUz: 'Isitiladigan massajli o\'rindiq qoplamasi 12V', categoryId: catBySlug['interior']!, merchantId: M2, price: '245000', weight: '1.500', isNew: true },
    { slug: 'armrest-universal', sku: 'ARMREST-UNI', nameRu: 'Подлокотник универсальный с боксом, экокожа', nameUz: 'Quti bilan universal qo\'l tayanchi, ekokoja', categoryId: catBySlug['interior']!, merchantId: M1, price: '125000', weight: '1.200' },
    { slug: 'steering-wheel-cover-leather', sku: 'SWC-LEATHER', nameRu: 'Оплётка на руль кожа натуральная M (37-39 см)', nameUz: 'Tabiiy charm rul qoplamasi M (37-39 sm)', categoryId: catBySlug['interior']!, merchantId: M2, price: '75000', weight: '0.250' },
    { slug: 'neck-pillow-memory-2', sku: 'PILLOW-NECK-2', nameRu: 'Подушка под шею с эффектом памяти, 2 шт.', nameUz: 'Xotira effektli bo\'yin yostig\'i, 2 dona', categoryId: catBySlug['interior']!, merchantId: M1, price: '95000', weight: '0.400' },
    { slug: 'trunk-organizer-foldable', sku: 'ORG-TRUNK-FOLD', nameRu: 'Органайзер в багажник складной 60л', nameUz: 'Yig\'iladigan yuk bo\'limi organayzeri 60l', categoryId: catBySlug['interior']!, merchantId: M2, price: '85000', weight: '0.900', isFeatured: true },
    { slug: 'sun-shade-windshield', sku: 'SHADE-WS', nameRu: 'Накидка от солнца на лобовое стекло, серебристая', nameUz: 'Quyoshdan oldingi oynaga kumush qoplama', categoryId: catBySlug['interior']!, merchantId: M1, price: '35000', weight: '0.300' },
    { slug: 'mirror-interior-panoramic', sku: 'MIRROR-PANO', nameRu: 'Зеркало салонное панорамное универсальное', nameUz: 'Salon panoramik ko\'zgu universal', categoryId: catBySlug['interior']!, merchantId: M2, price: '55000', weight: '0.400' },
    { slug: 'phone-holder-magnetic', sku: 'HOLDER-MAGNET', nameRu: 'Магнитный держатель телефона на дефлектор', nameUz: 'Deflektorga magnitli telefon ushlagichi', categoryId: catBySlug['interior']!, merchantId: M1, price: '45000', compareAtPrice: '60000', weight: '0.150', isOnSale: true },

    // =========================================================================
    // CONSUMABLES — Расходники (10 шт)
    // =========================================================================
    { slug: 'air-filter-bosch-1457433721', sku: 'BOSCH-1457433721', nameRu: 'Воздушный фильтр Bosch 1457433721', nameUz: 'Bosch 1457433721 havo filtri', categoryId: catBySlug['consumables']!, brandId: B('Bosch'), merchantId: M1, oemNumber: '1457433721', price: '85000', weight: '0.300' },
    { slug: 'oil-filter-mann-w7124', sku: 'MANN-W7124', nameRu: 'Масляный фильтр Mann W 712/4', nameUz: 'Mann W 712/4 yog\' filtri', categoryId: catBySlug['consumables']!, brandId: B('Mann'), merchantId: M1, oemNumber: 'W712/4', price: '52000', weight: '0.250' },
    { slug: 'cabin-filter-mann-cuk2939', sku: 'MANN-CUK2939', nameRu: 'Салонный фильтр Mann CUK 2939 угольный', nameUz: 'Mann CUK 2939 koʻmir salon filtri', categoryId: catBySlug['consumables']!, brandId: B('Mann'), merchantId: M2, oemNumber: 'CUK2939', price: '78000', weight: '0.300' },
    { slug: 'fuel-filter-mahle-kl83', sku: 'MAHLE-KL83', nameRu: 'Топливный фильтр Mahle KL 83', nameUz: 'Mahle KL 83 yoqilg\'i filtri', categoryId: catBySlug['consumables']!, brandId: B('Mahle'), merchantId: M1, oemNumber: 'KL83', price: '95000', weight: '0.250' },
    { slug: 'spark-plugs-ngk-bkr6e-4', sku: 'NGK-BKR6E-4', nameRu: 'Свечи зажигания NGK BKR6E, комплект 4 шт.', nameUz: 'NGK BKR6E uchqun shamlari, 4 dona', categoryId: catBySlug['consumables']!, brandId: B('NGK'), merchantId: M2, oemNumber: 'BKR6E', price: '120000', weight: '0.250', isFeatured: true },
    { slug: 'spark-plugs-denso-iridium-4', sku: 'DENSO-IK20-4', nameRu: 'Свечи иридиевые Denso IK20 IK20, 4 шт.', nameUz: 'Denso IK20 iridium shamlari, 4 dona', categoryId: catBySlug['consumables']!, brandId: B('Denso'), merchantId: M1, oemNumber: 'IK20', price: '280000', compareAtPrice: '340000', weight: '0.250', isOnSale: true },
    { slug: 'wiper-blades-bosch-aerotwin-600-450', sku: 'BOSCH-AT-600-450', nameRu: 'Щётки стеклоочистителя Bosch Aerotwin 600+450 мм', nameUz: 'Bosch Aerotwin oyna tozalagich, 600+450 mm', categoryId: catBySlug['consumables']!, brandId: B('Bosch'), merchantId: M2, price: '145000', weight: '0.350', isFeatured: true },
    { slug: 'lamp-h4-osram-night-breaker', sku: 'OSRAM-NB-H4', nameRu: 'Лампа галогенная Osram Night Breaker H4 12V 60/55W', nameUz: 'Osram Night Breaker H4 12V 60/55W galogen lampa', categoryId: catBySlug['consumables']!, brandId: B('Bosch'), merchantId: M1, price: '95000', weight: '0.080' },
    { slug: 'osram-night-breaker-h7-50w', sku: 'OSRAM-NB-H7', nameRu: 'Лампа галогенная Osram Night Breaker H7 12V 55W', nameUz: 'Osram Night Breaker H7 12V 55W galogen lampa', categoryId: catBySlug['consumables']!, brandId: B('Bosch'), merchantId: M1, price: '125000', weight: '0.060', isFeatured: true },
    { slug: 'floor-mats-cobalt-3d', sku: 'MATS-COBALT-3D', nameRu: 'Коврики салона 3D EVA для Chevrolet Cobalt, 5 шт.', nameUz: 'Chevrolet Cobalt uchun 3D EVA gilamchalari, 5 dona', categoryId: catBySlug['consumables']!, brandId: B('Chevrolet'), merchantId: M1, price: '485000', compareAtPrice: '625000', weight: '2.500', isOnSale: true, isFeatured: true },

    // =========================================================================
    // BRAKE-SYSTEM — Тормозная система (10 шт)
    // =========================================================================
    { slug: 'brake-pads-brembo-p83024', sku: 'BREMBO-P83024', nameRu: 'Колодки тормозные передние Brembo P 83 024', nameUz: 'Brembo P 83 024 old tormoz kolodkalari', categoryId: catBySlug['brake-system']!, brandId: B('Brembo'), merchantId: M1, oemNumber: '04465-33450', price: '420000', weight: '1.500' },
    { slug: 'brake-pads-ate-13046072142', sku: 'ATE-13.0460-7214.2', nameRu: 'Колодки тормозные задние ATE 13.0460-7214.2', nameUz: 'ATE 13.0460-7214.2 orqa tormoz kolodkalari', categoryId: catBySlug['brake-system']!, brandId: B('Brembo'), merchantId: M2, oemNumber: '13.0460-7214.2', price: '285000', weight: '1.200' },
    { slug: 'brake-disc-brembo-09a96211', sku: 'BREMBO-09A96211', nameRu: 'Тормозной диск передний Brembo 09.A962.11, 295mm', nameUz: 'Brembo 09.A962.11 old tormoz diski, 295mm', categoryId: catBySlug['brake-system']!, brandId: B('Brembo'), merchantId: M1, price: '680000', compareAtPrice: '780000', weight: '6.500', isOnSale: true, isFeatured: true },
    { slug: 'brake-disc-rear-cobalt', sku: 'DISC-REAR-COBALT', nameRu: 'Тормозной диск задний для Chevrolet Cobalt 240mm', nameUz: 'Chevrolet Cobalt orqa tormoz diski 240mm', categoryId: catBySlug['brake-system']!, brandId: B('Chevrolet'), merchantId: M2, price: '385000', weight: '4.000' },
    { slug: 'brake-hose-sachs-camry', sku: 'SACHS-HOSE-CAMRY', nameRu: 'Шланг тормозной передний Sachs для Toyota Camry', nameUz: 'Toyota Camry uchun Sachs old tormoz shlangi', categoryId: catBySlug['brake-system']!, brandId: B('Brembo'), merchantId: M1, price: '95000', weight: '0.200' },
    { slug: 'brake-master-cylinder-tokico', sku: 'TOKICO-MC-CAMRY', nameRu: 'Главный тормозной цилиндр Tokico для Toyota Camry XV40', nameUz: 'Tokico Toyota Camry XV40 uchun asosiy tormoz silindr', categoryId: catBySlug['brake-system']!, brandId: B('Brembo'), merchantId: M2, price: '880000', weight: '2.000' },
    { slug: 'brake-caliper-front-left-akebono', sku: 'AKEBONO-CALIP-L', nameRu: 'Суппорт тормозной передний левый Akebono', nameUz: 'Akebono old chap tormoz supporti', categoryId: catBySlug['brake-system']!, brandId: B('Brembo'), merchantId: M1, price: '1450000', compareAtPrice: '1680000', weight: '5.500', isOnSale: true },
    { slug: 'brake-drum-rear-lacetti', sku: 'DRUM-LACETTI', nameRu: 'Тормозной барабан задний для Chevrolet Lacetti', nameUz: 'Chevrolet Lacetti orqa tormoz barabani', categoryId: catBySlug['brake-system']!, brandId: B('Chevrolet'), merchantId: M2, price: '225000', weight: '5.000' },
    { slug: 'brake-fluid-reservoir-universal', sku: 'BFR-UNI', nameRu: 'Бачок тормозной жидкости универсальный 250мл', nameUz: 'Universal tormoz suyuqligi idishi 250ml', categoryId: catBySlug['brake-system']!, brandId: B('Bosch'), merchantId: M1, price: '65000', weight: '0.200' },
    { slug: 'parking-brake-cable-camry', sku: 'PB-CABLE-CAMRY', nameRu: 'Трос ручного тормоза Toyota Camry XV40, задний правый', nameUz: 'Toyota Camry XV40 qo\'l tormoz tepkichi, orqa o\'ng', categoryId: catBySlug['brake-system']!, brandId: B('Toyota'), merchantId: M2, price: '145000', weight: '0.600' },

    // =========================================================================
    // ENGINE-PARTS — Двигатель (10 шт)
    // =========================================================================
    { slug: 'timing-belt-gates-5419xs', sku: 'GATES-5419XS', nameRu: 'Ремень ГРМ Gates 5419XS Powergrip', nameUz: 'Gates 5419XS Powergrip taqsimlash kamari', categoryId: catBySlug['engine-parts']!, brandId: B('Bosch'), merchantId: M1, oemNumber: '5419XS', price: '185000', weight: '0.300', isFeatured: true },
    { slug: 'timing-belt-tensioner-dayco-atb2147', sku: 'DAYCO-ATB2147', nameRu: 'Натяжитель ремня ГРМ Dayco ATB2147', nameUz: 'Dayco ATB2147 taqsimlash kamar tortgichi', categoryId: catBySlug['engine-parts']!, brandId: B('Bosch'), merchantId: M2, oemNumber: 'ATB2147', price: '245000', weight: '0.400' },
    { slug: 'water-pump-aisin-wpt-118', sku: 'AISIN-WPT118', nameRu: 'Помпа Aisin WPT-118 для Toyota Camry 2.4', nameUz: 'Toyota Camry 2.4 uchun Aisin WPT-118 nasos', categoryId: catBySlug['engine-parts']!, brandId: B('Toyota'), merchantId: M1, oemNumber: 'WPT-118', price: '385000', compareAtPrice: '450000', weight: '1.200', isOnSale: true },
    { slug: 'valve-cover-gasket-elring-219330', sku: 'ELRING-219330', nameRu: 'Прокладка клапанной крышки Elring 219.330', nameUz: 'Elring 219.330 klapan qopqog\'i zichlamasi', categoryId: catBySlug['engine-parts']!, brandId: B('Brembo'), merchantId: M2, oemNumber: '219.330', price: '95000', weight: '0.150' },
    { slug: 'crankshaft-seal-front-victor', sku: 'VR-SEAL-FRONT', nameRu: 'Сальник коленвала передний Victor Reinz 81-26706-00', nameUz: 'Victor Reinz 81-26706-00 old tirsak vali zichlagichi', categoryId: catBySlug['engine-parts']!, brandId: B('Brembo'), merchantId: M1, oemNumber: '81-26706-00', price: '45000', weight: '0.050' },
    { slug: 'piston-rings-set-mahle-08240n2', sku: 'MAHLE-08240N2', nameRu: 'Кольца поршневые Mahle 08240N2, 88.5mm STD', nameUz: 'Mahle 08240N2 piston halqalari, 88.5mm STD', categoryId: catBySlug['engine-parts']!, brandId: B('Mahle'), merchantId: M2, oemNumber: '08240N2', price: '485000', weight: '0.300' },
    { slug: 'head-bolts-reinz-141-49034-01', sku: 'REINZ-14149034', nameRu: 'Болты ГБЦ Reinz 14-149034-01, комплект 10 шт.', nameUz: 'Reinz 14-149034-01 GBC boltlari, 10 dona', categoryId: catBySlug['engine-parts']!, brandId: B('Brembo'), merchantId: M1, oemNumber: '14-149034-01', price: '185000', weight: '0.500' },
    { slug: 'engine-mount-front-camry', sku: 'EM-FRONT-CAMRY', nameRu: 'Опора двигателя передняя Toyota Camry XV40 2.4', nameUz: 'Toyota Camry XV40 2.4 old dvigatel tayanchi', categoryId: catBySlug['engine-parts']!, brandId: B('Toyota'), merchantId: M2, price: '385000', weight: '2.000' },
    { slug: 'spark-coil-denso-673-1306', sku: 'DENSO-673-1306', nameRu: 'Катушка зажигания Denso 673-1306 для Toyota', nameUz: 'Toyota uchun Denso 673-1306 uchqun g\'altagi', categoryId: catBySlug['engine-parts']!, brandId: B('Denso'), merchantId: M1, oemNumber: '673-1306', price: '420000', isFeatured: true },
    { slug: 'thermostat-mahle-th35-87', sku: 'MAHLE-TH35-87', nameRu: 'Термостат Mahle TH 35 87, 87°C', nameUz: 'Mahle TH 35 87 termostat, 87°C', categoryId: catBySlug['engine-parts']!, brandId: B('Mahle'), merchantId: M2, oemNumber: 'TH35 87', price: '125000', weight: '0.200' },

    // =========================================================================
    // ELECTRICAL — Электрика, аккумуляторы (10 шт)
    // =========================================================================
    { slug: 'battery-varta-blue-60ah', sku: 'VARTA-BLUE-60', nameRu: 'Аккумулятор Varta Blue Dynamic D24 60Ah 540A', nameUz: 'Varta Blue Dynamic D24 60Ah 540A akkumulyator', categoryId: catBySlug['electrical']!, brandId: B('Bosch'), merchantId: M1, price: '850000', compareAtPrice: '980000', weight: '15.000', isOnSale: true, isFeatured: true },
    { slug: 'battery-bosch-s5-75ah', sku: 'BOSCH-S5-75', nameRu: 'Аккумулятор Bosch S5 008 77Ah 780A', nameUz: 'Bosch S5 008 77Ah 780A akkumulyator', categoryId: catBySlug['electrical']!, brandId: B('Bosch'), merchantId: M2, price: '1180000', weight: '20.500' },
    { slug: 'starter-bosch-camry', sku: 'BOSCH-STARTER-CAMRY', nameRu: 'Стартер Bosch для Toyota Camry XV40 2.4', nameUz: 'Toyota Camry XV40 2.4 uchun Bosch starteri', categoryId: catBySlug['electrical']!, brandId: B('Bosch'), merchantId: M1, price: '1850000', weight: '4.500' },
    { slug: 'alternator-denso-camry', sku: 'DENSO-ALT-CAMRY', nameRu: 'Генератор Denso 100A для Toyota Camry XV40', nameUz: 'Toyota Camry XV40 uchun Denso 100A generator', categoryId: catBySlug['electrical']!, brandId: B('Denso'), merchantId: M2, price: '2250000', compareAtPrice: '2680000', weight: '6.000', isOnSale: true },
    { slug: 'starter-relay-12v', sku: 'STARTER-REL-12V', nameRu: 'Реле стартера 12V Behr Hella 4MD003520-08', nameUz: 'Behr Hella 4MD003520-08 12V starter relesi', categoryId: catBySlug['electrical']!, brandId: B('Bosch'), merchantId: M2, oemNumber: '4MD003520-08', price: '85000', weight: '0.150', isFeatured: true },
    { slug: 'spark-plug-wires-ngk-rc-te77', sku: 'NGK-RC-TE77', nameRu: 'Провода зажигания NGK RC-TE77 для Toyota', nameUz: 'Toyota uchun NGK RC-TE77 uchqun simlari', categoryId: catBySlug['electrical']!, brandId: B('NGK'), merchantId: M1, oemNumber: 'RC-TE77', price: '195000', weight: '0.400' },
    { slug: 'oxygen-sensor-bosch-15814', sku: 'BOSCH-LSF4', nameRu: 'Датчик кислорода (лямбда-зонд) Bosch 0258006537', nameUz: 'Bosch 0258006537 kislorod datchigi (lambda zond)', categoryId: catBySlug['electrical']!, brandId: B('Bosch'), merchantId: M2, oemNumber: '0258006537', price: '485000', weight: '0.250' },
    { slug: 'crankshaft-position-sensor-ngk', sku: 'NGK-CKP-CAMRY', nameRu: 'Датчик коленвала NGK для Toyota Camry XV40', nameUz: 'Toyota Camry XV40 uchun NGK tirsak vali datchigi', categoryId: catBySlug['electrical']!, brandId: B('NGK'), merchantId: M1, price: '285000', weight: '0.150' },
    { slug: 'lamp-w5w-osram-led', sku: 'OSRAM-W5W-LED', nameRu: 'Лампа габаритная W5W Osram LED 6000K, 2 шт.', nameUz: 'Osram W5W LED 6000K gabarit lampasi, 2 dona', categoryId: catBySlug['electrical']!, brandId: B('Bosch'), merchantId: M2, price: '65000', weight: '0.050' },
    { slug: 'fuse-set-mini-universal', sku: 'FUSES-MINI-100', nameRu: 'Набор предохранителей mini 5-30A, 100 шт.', nameUz: 'mini 5-30A saqlagichlar to\'plami, 100 dona', categoryId: catBySlug['electrical']!, brandId: B('Bosch'), merchantId: M1, price: '45000', weight: '0.200' },

    // =========================================================================
    // SUSPENSION — Подвеска и рулевое (10 шт)
    // =========================================================================
    { slug: 'shock-absorber-front-kyb-camry', sku: 'KYB-EXCEL-G-CAMRY-F', nameRu: 'Стойка передняя KYB Excel-G для Toyota Camry XV40', nameUz: 'Toyota Camry XV40 uchun KYB Excel-G old stoyka', categoryId: catBySlug['suspension']!, brandId: B('Brembo'), merchantId: M1, oemNumber: '339024', price: '785000', isFeatured: true },
    { slug: 'shock-absorber-rear-monroe-cobalt', sku: 'MONROE-COBALT-R', nameRu: 'Амортизатор задний Monroe для Chevrolet Cobalt', nameUz: 'Chevrolet Cobalt uchun Monroe orqa amortizator', categoryId: catBySlug['suspension']!, brandId: B('Brembo'), merchantId: M2, price: '385000', compareAtPrice: '450000', weight: '3.000', isOnSale: true },
    { slug: 'spring-front-lesjofors-lacetti', sku: 'LESJ-FRONT-LACETTI', nameRu: 'Пружина передняя Lesjofors для Chevrolet Lacetti', nameUz: 'Chevrolet Lacetti uchun Lesjofors old prujina', categoryId: catBySlug['suspension']!, brandId: B('Brembo'), merchantId: M1, price: '185000', weight: '2.500' },
    { slug: 'stabilizer-bush-lemforder-camry', sku: 'LEM-STAB-CAMRY', nameRu: 'Втулка стабилизатора Lemforder для Toyota Camry, 2 шт.', nameUz: 'Toyota Camry uchun Lemforder stabilizator vtulkasi, 2 dona', categoryId: catBySlug['suspension']!, brandId: B('Brembo'), merchantId: M2, price: '65000', weight: '0.200' },
    { slug: 'control-arm-bushing-camry', sku: 'BUSH-LCA-CAMRY', nameRu: 'Сайлентблок рычага передний Toyota Camry XV40', nameUz: 'Toyota Camry XV40 old rul vtulkasi (saylentblok)', categoryId: catBySlug['suspension']!, brandId: B('Toyota'), merchantId: M1, price: '85000', weight: '0.300' },
    { slug: 'ball-joint-trw-camry', sku: 'TRW-BALL-CAMRY', nameRu: 'Шаровая опора TRW JBJ7572 для Toyota Camry', nameUz: 'Toyota Camry uchun TRW JBJ7572 sharli tayanch', categoryId: catBySlug['suspension']!, brandId: B('Brembo'), merchantId: M2, oemNumber: 'JBJ7572', price: '145000', weight: '0.500' },
    { slug: 'tie-rod-end-moog-camry', sku: 'MOOG-TR-CAMRY', nameRu: 'Наконечник рулевой Moog для Toyota Camry, правый', nameUz: 'Toyota Camry uchun Moog rul uchi, o\'ng', categoryId: catBySlug['suspension']!, brandId: B('Brembo'), merchantId: M1, price: '125000', compareAtPrice: '155000', weight: '0.400', isOnSale: true },
    { slug: 'steering-rack-camry-xv40', sku: 'RACK-CAMRY-XV40', nameRu: 'Рулевая рейка Toyota Camry XV40 в сборе', nameUz: 'Toyota Camry XV40 to\'liq rul reykasi', categoryId: catBySlug['suspension']!, brandId: B('Toyota'), merchantId: M2, price: '4250000', weight: '15.000' },
    { slug: 'wheel-bearing-hub-front-camry', sku: 'BEARING-HUB-CAMRY-F', nameRu: 'Ступичный подшипник передний Toyota Camry XV40', nameUz: 'Toyota Camry XV40 old g\'ildirak podshipnigi', categoryId: catBySlug['suspension']!, brandId: B('Toyota'), merchantId: M1, price: '385000', weight: '1.500', isFeatured: true },
    { slug: 'cv-joint-outer-cobalt', sku: 'CV-OUT-COBALT', nameRu: 'ШРУС наружный Chevrolet Cobalt 24x30', nameUz: 'Chevrolet Cobalt tashqi SHRUS 24x30', categoryId: catBySlug['suspension']!, brandId: B('Chevrolet'), merchantId: M2, price: '285000', weight: '1.800' },

    // =========================================================================
    // ACCESSORIES — Аксессуары (10 шт)
    // =========================================================================
    { slug: 'dashcam-70mai-pro-plus', sku: '70MAI-PRO-PLUS', nameRu: 'Видеорегистратор 70mai Dash Cam Pro Plus 2.7K', nameUz: '70mai Dash Cam Pro Plus 2.7K videoregistrator', categoryId: catBySlug['accessories']!, merchantId: M1, price: '1250000', compareAtPrice: '1450000', weight: '0.250', isOnSale: true, isFeatured: true },
    { slug: 'parking-sensor-4', sku: 'PARKTRON-4', nameRu: 'Парктроник 4 датчика с дисплеем', nameUz: '4 datchikli displayli parktronik', categoryId: catBySlug['accessories']!, merchantId: M2, price: '385000', weight: '0.500', isNew: true },
    { slug: 'phone-holder-suction', sku: 'HOLDER-SUCT', nameRu: 'Держатель телефона на присоске универсальный', nameUz: 'Universal so\'rg\'ichli telefon ushlagichi', categoryId: catBySlug['accessories']!, merchantId: M1, price: '55000', weight: '0.150' },
    { slug: 'usb-charger-12v-3port', sku: 'USB-12V-3', nameRu: 'Автомобильное зарядное USB 12V→5V 3 порта QC3.0', nameUz: 'USB 12V→5V 3 portli QC3.0 avto zaryadlovchi', categoryId: catBySlug['accessories']!, brandId: B('Bosch'), merchantId: M2, price: '75000', weight: '0.100' },
    { slug: 'fm-transmitter-bt5-0', sku: 'FM-BT5', nameRu: 'FM-трансмиттер Bluetooth 5.0 с USB зарядкой', nameUz: 'USB zaryadli Bluetooth 5.0 FM transmitter', categoryId: catBySlug['accessories']!, merchantId: M1, price: '95000', weight: '0.150' },
    { slug: 'vacuum-cleaner-12v-120w', sku: 'VACUUM-12V-120', nameRu: 'Автомобильный пылесос 12V 120W с HEPA фильтром', nameUz: 'HEPA filtrli 12V 120W avto changyutgich', categoryId: catBySlug['accessories']!, merchantId: M2, price: '385000', compareAtPrice: '480000', weight: '1.200', isOnSale: true },
    { slug: 'compressor-12v-berkut', sku: 'BERKUT-R15', nameRu: 'Компрессор автомобильный Berkut R15, 35 л/мин', nameUz: 'Berkut R15 avto kompressor, 35 l/min', categoryId: catBySlug['accessories']!, merchantId: M1, price: '485000', weight: '2.500', isFeatured: true },
    { slug: 'tow-strap-5t', sku: 'TOW-STRAP-5T', nameRu: 'Буксировочный трос 5т, 4м с крюками', nameUz: 'Ilgakli buksir tepkichi 5t, 4m', categoryId: catBySlug['accessories']!, merchantId: M2, price: '85000', weight: '1.500' },
    { slug: 'warning-triangle', sku: 'WARN-TRIANGLE', nameRu: 'Знак аварийной остановки треугольный ГОСТ', nameUz: 'Avariya to\'xtash uchburchak belgisi GOST', categoryId: catBySlug['accessories']!, merchantId: M1, price: '35000', weight: '0.500' },
    { slug: 'first-aid-kit-auto', sku: 'FAK-AUTO', nameRu: 'Аптечка автомобильная (обновлённый состав)', nameUz: 'Avto dorixonasi (yangilangan tarkib)', categoryId: catBySlug['accessories']!, merchantId: M2, price: '95000', weight: '0.600', isFeatured: true },
  ];

  // Удаляем устаревшие DEMO-заглушки от предыдущей версии seed.
  // Каскад: связанные ProductCompatibility/Image/InventoryBalance подчищаются автоматически.
  const removed = await prisma.product.deleteMany({
    where: { sku: { startsWith: 'DEMO-' } },
  });
  if (removed.count > 0) console.log(`  • removed ${removed.count} old DEMO products`);

  for (const p of products) {
    const data = {
      categoryId: p.categoryId,
      brandId: p.brandId,
      slug: p.slug,
      name: ml(p.nameRu, p.nameUz),
      description: ml(`${p.nameRu} — оригинальная запчасть.`, `${p.nameUz} — original ehtiyot qism.`),
      oemNumber: p.oemNumber,
      price: new Prisma.Decimal(p.price),
      compareAtPrice: p.compareAtPrice ? new Prisma.Decimal(p.compareAtPrice) : null,
      weight: p.weight ? new Prisma.Decimal(p.weight) : null,
      vatRate: new Prisma.Decimal('12'),
      status: ProductStatus.ACTIVE,
      isFeatured: p.isFeatured ?? false,
      isOnSale: p.isOnSale ?? false,
      isNew: p.isNew ?? false,
      publishedAt: new Date(),
    };
    await prisma.product.upsert({
      where: { merchantId_sku: { merchantId: p.merchantId, sku: p.sku } },
      update: data,
      create: { merchantId: p.merchantId, sku: p.sku, ...data },
    });
  }

  // Привязка одного товара к Toyota Camry XV40 для демо compatibility
  const brakePadsProduct = await prisma.product.findFirst({
    where: { sku: 'BREMBO-P83024' },
  });
  const camryModificationId = '40000000-0000-4000-8000-000000000010';
  if (brakePadsProduct) {
    const mod = await prisma.carModification.findUnique({
      where: { id: camryModificationId },
    });
    if (mod) {
      const existing = await prisma.productCompatibility.findFirst({
        where: { productId: brakePadsProduct.id, carModificationId: mod.id },
      });
      if (!existing) {
        await prisma.productCompatibility.create({
          data: { productId: brakePadsProduct.id, carModificationId: mod.id },
        });
      }
    }
  }

  // Демо UserGarage с VIN для теста /search/by-vin
  // VIN из реального Toyota Camry XV40: JTNBE40K003123456
  const customer = await prisma.user.findFirst({ where: { email: 'customer1@example.com' } });
  if (customer) {
    const existing = await prisma.userGarage.findFirst({
      where: { userId: customer.id, vin: 'JTNBE40K003123456' },
    });
    if (!existing) {
      await prisma.userGarage.create({
        data: {
          userId: customer.id,
          vin: 'JTNBE40K003123456',
          carModificationId: camryModificationId,
          year: 2010,
          nickname: 'Toyota Camry',
          isPrimary: true,
        },
      });
    }
  }

  console.log(`  • products: ${products.length}, +1 compatibility link, +1 demo VIN`);
}

// ---------------------------------------------------------------------------
async function seedWarehouse(): Promise<void> {
  await prisma.warehouse.upsert({
    where: { id: ID.warehouse.main },
    update: {},
    create: {
      id: ID.warehouse.main,
      code: 'TASH-MAIN',
      name: ml('Главный склад Ташкент', 'Bosh ombor Toshkent'),
      type: WarehouseType.PLATFORM,
      address: 'г. Ташкент, ул. Складская, 5',
      region: 'Ташкент',
      city: 'Ташкент',
      isActive: true,
      isPickupPoint: true,
    },
  });

  // 3 зоны × 2 racks × 2 shelves × 5 cells = 60 ячеек (для seed достаточно)
  const zonesData = [
    { code: 'A', name: ml('Зона A — Шины', 'Zona A — Shinalar') },
    { code: 'B', name: ml('Зона B — Расходники', 'Zona B — Sarflanadigan') },
    { code: 'C', name: ml('Зона C — Тормозные', 'Zona C — Tormoz') },
  ];

  let cellsCount = 0;
  for (const z of zonesData) {
    const zone = await prisma.warehouseZone.upsert({
      where: { warehouseId_code: { warehouseId: ID.warehouse.main, code: z.code } },
      update: {},
      create: { warehouseId: ID.warehouse.main, code: z.code, name: z.name },
    });

    for (let r = 1; r <= 2; r++) {
      const rackCode = `${z.code}-${String(r).padStart(2, '0')}`;
      const rack = await prisma.warehouseRack.upsert({
        where: { zoneId_code: { zoneId: zone.id, code: rackCode } },
        update: {},
        create: { zoneId: zone.id, code: rackCode, position: r },
      });

      for (let s = 1; s <= 2; s++) {
        const shelfCode = `${rackCode}-${s}`;
        const shelf = await prisma.warehouseShelf.upsert({
          where: { rackId_code: { rackId: rack.id, code: shelfCode } },
          update: {},
          create: { rackId: rack.id, code: shelfCode, level: s },
        });

        for (let c = 1; c <= 5; c++) {
          const cellCode = `${shelfCode}-${String(c).padStart(2, '0')}`;
          await prisma.warehouseCell.upsert({
            where: { code: cellCode },
            update: {},
            create: {
              shelfId: shelf.id,
              code: cellCode,
              qrCode: `qr_${cellCode}`,
              barcode: `bc_${cellCode}`,
              cellType: CellType.STANDARD,
            },
          });
          cellsCount++;
        }
      }
    }
  }

  console.log(`  • warehouse: 1, zones: ${zonesData.length}, cells: ${cellsCount}`);
}

// ---------------------------------------------------------------------------
async function seedInventory(): Promise<void> {
  // Создаём inventory_balances для всех ACTIVE товаров:
  //   Type 1 (FBO) — на складе платформы, 50 шт.
  //   Type 2 (FBS) — на складе мерчанта, 20 шт.
  // composite unique (productId, merchantId, cellId=NULL) не работает через upsert
  // (NULL в PostgreSQL не уникален), поэтому findFirst + create.
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    include: { merchant: { select: { merchantType: true } } },
  });

  const now = new Date();
  let created = 0;

  for (const p of products) {
    const isType1 = p.merchant.merchantType === 'TYPE_1';
    const warehouseId = isType1 ? ID.warehouse.main : null;
    const qty = isType1 ? 50 : 20;

    const existing = await prisma.inventoryBalance.findFirst({
      where: { productId: p.id, merchantId: p.merchantId, cellId: null },
    });
    if (!existing) {
      await prisma.inventoryBalance.create({
        data: {
          productId: p.id,
          merchantId: p.merchantId,
          warehouseId,
          cellId: null,
          quantityAvailable: qty,
          quantityReserved: 0,
          lastReceivedAt: now,
          oldestReceivedAt: now,
        },
      });
      created++;
    }
  }
  console.log(`  • inventory balances: ${created} created (already existed: ${products.length - created})`);
}

// ---------------------------------------------------------------------------
async function seedDeliveryMethods(): Promise<void> {
  const methods = [
    {
      code: 'self-pickup',
      name: ml('Самовывоз', 'O\'zi olib ketish'),
      description: ml('Заберите заказ в пункте выдачи', 'Buyurtmani olib ketish punktidan oling'),
      type: DeliveryMethodType.SELF_PICKUP,
      baseCost: '0',
      minDays: 1,
      maxDays: 2,
    },
    {
      code: 'platform-courier',
      name: ml('Курьер по Ташкенту', 'Toshkent bo\'ylab kuryer'),
      description: ml('Курьер платформы привезёт заказ', 'Platforma kuryeri buyurtmangizni yetkazib beradi'),
      type: DeliveryMethodType.PLATFORM_COURIER,
      baseCost: '25000',
      minDays: 1,
      maxDays: 1,
    },
    {
      code: 'yandex-go',
      name: ml('Yandex Go (доставка)', 'Yandex Go (yetkazib berish)'),
      description: ml('Доставка через Yandex Go', 'Yandex Go orqali yetkazib berish'),
      type: DeliveryMethodType.EXTERNAL_DELIVERY,
      provider: 'yandex_go',
      baseCost: '40000',
      minDays: 1,
      maxDays: 1,
    },
    {
      code: 'bts',
      name: ml('BTS (по Узбекистану)', 'BTS (O\'zbekiston bo\'ylab)'),
      description: ml('Доставка по областям через BTS', 'BTS orqali viloyatlarga'),
      type: DeliveryMethodType.EXTERNAL_DELIVERY,
      provider: 'bts',
      baseCost: '35000',
      minDays: 2,
      maxDays: 5,
    },
  ];

  for (let i = 0; i < methods.length; i++) {
    const m = methods[i]!;
    await prisma.deliveryMethod.upsert({
      where: { code: m.code },
      update: {},
      create: {
        code: m.code,
        name: m.name,
        description: m.description,
        type: m.type,
        provider: m.provider,
        baseCost: new Prisma.Decimal(m.baseCost),
        minDeliveryDays: m.minDays,
        maxDeliveryDays: m.maxDays,
        position: i,
        isActive: true,
      },
    });
  }

  // Зона доставки — Ташкент
  await prisma.deliveryZone.upsert({
    where: { regionCode: 'TASH' },
    update: {},
    create: {
      regionCode: 'TASH',
      name: ml('Ташкент', 'Toshkent'),
      cities: ['Ташкент', 'Toshkent'],
    },
  });

  console.log(`  • delivery methods: ${methods.length}, zones: 1`);
}

// ---------------------------------------------------------------------------
async function seedNotificationTemplates(): Promise<void> {
  const templates: Array<{
    code: string;
    name: string;
    channel: NotificationChannel;
    subjectRu?: string;
    subjectUz?: string;
    bodyRu: string;
    bodyUz: string;
    vars: string[];
  }> = [
    {
      code: 'welcome',
      name: 'Welcome email',
      channel: NotificationChannel.EMAIL,
      subjectRu: 'Добро пожаловать в Домкрат!',
      subjectUz: 'Domkratga xush kelibsiz!',
      bodyRu: 'Здравствуйте, {{firstName}}! Вы успешно зарегистрировались.',
      bodyUz: 'Salom {{firstName}}! Siz muvaffaqiyatli ro\'yxatdan o\'tdingiz.',
      vars: ['firstName'],
    },
    {
      code: 'email_verification',
      name: 'Email verification',
      channel: NotificationChannel.EMAIL,
      subjectRu: 'Подтвердите email — Домкрат',
      subjectUz: 'Emailni tasdiqlang — Domkrat',
      bodyRu: 'Ваш код подтверждения: {{code}}. Действителен 5 минут.',
      bodyUz: 'Tasdiqlash kodingiz: {{code}}. 5 daqiqa amal qiladi.',
      vars: ['code'],
    },
    {
      code: 'password_reset',
      name: 'Password reset',
      channel: NotificationChannel.EMAIL,
      subjectRu: 'Восстановление пароля',
      subjectUz: 'Parolni tiklash',
      bodyRu: 'Код для восстановления пароля: {{code}}',
      bodyUz: 'Parolni tiklash uchun kod: {{code}}',
      vars: ['code'],
    },
    {
      code: 'order_created',
      name: 'Order created',
      channel: NotificationChannel.SMS,
      bodyRu: 'Заказ {{orderNumber}} создан. Сумма: {{total}} сум.',
      bodyUz: 'Buyurtma {{orderNumber}} yaratildi. Summa: {{total}} so\'m.',
      vars: ['orderNumber', 'total'],
    },
    {
      code: 'order_paid',
      name: 'Order paid',
      channel: NotificationChannel.SMS,
      bodyRu: 'Заказ {{orderNumber}} оплачен. Спасибо!',
      bodyUz: 'Buyurtma {{orderNumber}} to\'landi. Rahmat!',
      vars: ['orderNumber'],
    },
    {
      code: 'order_assembled',
      name: 'Order assembled',
      channel: NotificationChannel.SMS,
      bodyRu: 'Заказ {{orderNumber}} собран и передан в доставку.',
      bodyUz: 'Buyurtma {{orderNumber}} yig\'ildi va yetkazib berishga topshirildi.',
      vars: ['orderNumber'],
    },
    {
      code: 'out_for_delivery',
      name: 'Out for delivery',
      channel: NotificationChannel.SMS,
      bodyRu: 'Курьер выехал к вам с заказом {{orderNumber}}.',
      bodyUz: 'Kuryer {{orderNumber}} buyurtmasi bilan sizga yo\'lda.',
      vars: ['orderNumber'],
    },
    {
      code: 'order_delivered',
      name: 'Order delivered',
      channel: NotificationChannel.SMS,
      bodyRu: 'Заказ {{orderNumber}} доставлен. Подтвердите в приложении.',
      bodyUz: 'Buyurtma {{orderNumber}} yetkazib berildi. Ilovada tasdiqlang.',
      vars: ['orderNumber'],
    },
    {
      code: 'merchant_new_order',
      name: 'Merchant new order',
      channel: NotificationChannel.EMAIL,
      subjectRu: 'Новый заказ {{orderNumber}}',
      subjectUz: 'Yangi buyurtma {{orderNumber}}',
      bodyRu: 'Поступил новый заказ {{orderNumber}}. Обработать в кабинете.',
      bodyUz: 'Yangi buyurtma {{orderNumber}} keldi. Kabinetda ko\'rib chiqing.',
      vars: ['orderNumber'],
    },
    {
      code: 'withdrawal_completed',
      name: 'Withdrawal completed',
      channel: NotificationChannel.EMAIL,
      subjectRu: 'Выплата произведена',
      subjectUz: 'To\'lov amalga oshirildi',
      bodyRu: 'Выплата {{amount}} сум перечислена на ваш счёт.',
      bodyUz: 'To\'lov {{amount}} so\'m hisobingizga o\'tkazildi.',
      vars: ['amount'],
    },
  ];

  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { code: t.code },
      update: {},
      create: {
        code: t.code,
        name: t.name,
        channel: t.channel,
        subjectTemplate: t.subjectRu ? ml(t.subjectRu, t.subjectUz ?? t.subjectRu) : undefined,
        bodyTemplate: ml(t.bodyRu, t.bodyUz),
        variables: t.vars,
        isActive: true,
      },
    });
  }

  console.log(`  • notification templates: ${templates.length}`);
}

// ---------------------------------------------------------------------------
async function seedSettingsAndFaq(): Promise<void> {
  const settings = [
    {
      key: 'default_commission_rate',
      value: { value: '10.00' },
      description: 'Комиссия платформы по умолчанию (%)',
      category: 'finance',
      isPublic: false,
    },
    {
      key: 'default_vat_rate',
      value: { value: '12.00' },
      description: 'Ставка НДС (%)',
      category: 'finance',
      isPublic: false,
    },
    {
      key: 'order_reservation_minutes',
      value: { value: 15 },
      description: 'Время резерва товаров под неоплаченный заказ (мин)',
      category: 'orders',
      isPublic: false,
    },
    {
      key: 'merchant_hold_days',
      value: { value: 7 },
      description: 'Период удержания средств после COMPLETED заказа',
      category: 'finance',
      isPublic: false,
    },
    {
      key: 'platform_phone',
      value: { value: '+998 71 200 00 00' },
      description: 'Контактный телефон',
      category: 'public',
      isPublic: true,
    },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  // Несколько FAQ
  const faqs = [
    {
      category: 'delivery',
      question: ml('Сколько стоит доставка по Ташкенту?', 'Toshkent bo\'ylab yetkazib berish narxi qancha?'),
      answer: ml('25 000 сум — курьер платформы.', '25 000 so\'m — platforma kuryeri.'),
    },
    {
      category: 'payment',
      question: ml('Какие способы оплаты поддерживаются?', 'Qaysi to\'lov usullari qo\'llab-quvvatlanadi?'),
      answer: ml('Click, Payme, Uzum и наличными курьеру.', 'Click, Payme, Uzum va kuryer orqali naqd.'),
    },
    {
      category: 'returns',
      question: ml('Сколько дней на возврат?', 'Qaytarish uchun necha kun?'),
      answer: ml('14 дней с момента получения, кроме расходных материалов.', 'Olganingizdan 14 kun ichida, sarflanadigan mahsulotlar bundan mustasno.'),
    },
  ];

  for (let i = 0; i < faqs.length; i++) {
    const f = faqs[i]!;
    await prisma.faq.upsert({
      where: { id: `50000000-0000-4000-8000-00000000000${i + 1}` },
      update: {},
      create: {
        id: `50000000-0000-4000-8000-00000000000${i + 1}`,
        category: f.category,
        question: f.question,
        answer: f.answer,
        position: i,
        status: FaqStatus.ACTIVE,
      },
    });
  }

  console.log(`  • settings: ${settings.length}, faqs: ${faqs.length}`);
}

// ---------------------------------------------------------------------------
main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
