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

  console.log('[seed] done ✓');
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
  // Категории (parent + children)
  const rootCategories = [
    { slug: 'tires-and-wheels', name: ml('Шины и диски', 'Shinalar va disklar') },
    { slug: 'consumables', name: ml('Расходные материалы', 'Sarflanadigan materiallar') },
    { slug: 'brake-system', name: ml('Тормозная система', 'Tormoz tizimi') },
    { slug: 'engine-parts', name: ml('Двигатель', 'Dvigatel') },
    { slug: 'electrical', name: ml('Электрика', 'Elektrika') },
    { slug: 'body-parts', name: ml('Кузовные запчасти', 'Korpus ehtiyot qismlari') },
    { slug: 'suspension', name: ml('Подвеска и рулевое', 'Osma va rulli') },
    { slug: 'interior', name: ml('Салон', 'Salon') },
    { slug: 'fluids', name: ml('Жидкости и масла', 'Suyuqliklar va yog\'lar') },
    { slug: 'accessories', name: ml('Аксессуары', 'Aksessuarlar') },
  ];

  for (let i = 0; i < rootCategories.length; i++) {
    const cat = rootCategories[i]!;
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { slug: cat.slug, name: cat.name, position: i, level: 0 },
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

  // Бренды
  const brands = [
    'Bosch',
    'Mann',
    'Mahle',
    'Denso',
    'NGK',
    'Brembo',
    'Continental',
    'Castrol',
    'Mobil 1',
    'Hyundai',
    'Toyota',
    'Knecht',
  ];
  for (let i = 0; i < brands.length; i++) {
    const name = brands[i]!;
    await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name, slug: name.toLowerCase().replace(/\s+/g, '-'), isActive: true, position: i },
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
  const categoryConsum = await prisma.category.findUnique({ where: { slug: 'consumables' } });
  const categoryBrake = await prisma.category.findUnique({ where: { slug: 'brake-system' } });
  const categoryFluids = await prisma.category.findUnique({ where: { slug: 'fluids' } });
  const categoryTires = await prisma.category.findUnique({ where: { slug: 'tires-and-wheels' } });
  const bosch = await prisma.brand.findUnique({ where: { name: 'Bosch' } });
  const mann = await prisma.brand.findUnique({ where: { name: 'Mann' } });
  const brembo = await prisma.brand.findUnique({ where: { name: 'Brembo' } });
  const castrol = await prisma.brand.findUnique({ where: { name: 'Castrol' } });
  const continental = await prisma.brand.findUnique({ where: { name: 'Continental' } });

  if (
    !categoryConsum ||
    !categoryBrake ||
    !categoryFluids ||
    !categoryTires ||
    !bosch ||
    !mann ||
    !brembo ||
    !castrol ||
    !continental
  ) {
    throw new Error('Categories/brands not seeded properly');
  }

  type ProductSeed = {
    slug: string;
    sku: string;
    nameRu: string;
    nameUz: string;
    categoryId: string;
    brandId: string;
    merchantId: string;
    oemNumber?: string;
    price: string;
    weight?: string;
  };

  const products: ProductSeed[] = [
    {
      slug: 'air-filter-bosch-1457433721',
      sku: 'BOSCH-1457433721',
      nameRu: 'Воздушный фильтр Bosch 1457433721',
      nameUz: 'Havo filtri Bosch 1457433721',
      categoryId: categoryConsum.id,
      brandId: bosch.id,
      merchantId: ID.merchant.type1,
      oemNumber: '1457433721',
      price: '85000',
      weight: '0.300',
    },
    {
      slug: 'oil-filter-mann-w7124',
      sku: 'MANN-W7124',
      nameRu: 'Масляный фильтр Mann W 712/4',
      nameUz: 'Yog\' filtri Mann W 712/4',
      categoryId: categoryConsum.id,
      brandId: mann.id,
      merchantId: ID.merchant.type1,
      oemNumber: 'W712/4',
      price: '52000',
      weight: '0.250',
    },
    {
      slug: 'brake-pads-brembo-p83024',
      sku: 'BREMBO-P83024',
      nameRu: 'Колодки тормозные передние Brembo P 83 024',
      nameUz: 'Old tormoz kolodkalari Brembo P 83 024',
      categoryId: categoryBrake.id,
      brandId: brembo.id,
      merchantId: ID.merchant.type1,
      oemNumber: '04465-33450',
      price: '420000',
      weight: '1.500',
    },
    {
      slug: 'engine-oil-castrol-magnatec-5w40-4l',
      sku: 'CASTROL-MAG-5W40-4L',
      nameRu: 'Масло моторное Castrol Magnatec 5W-40 4 л',
      nameUz: 'Motor moyi Castrol Magnatec 5W-40 4 l',
      categoryId: categoryFluids.id,
      brandId: castrol.id,
      merchantId: ID.merchant.type1,
      price: '380000',
      weight: '3.700',
    },
    {
      slug: 'tire-continental-205-55-r16',
      sku: 'CONTI-205-55-R16',
      nameRu: 'Шина Continental ContiPremiumContact 5 205/55 R16',
      nameUz: 'Shina Continental ContiPremiumContact 5 205/55 R16',
      categoryId: categoryTires.id,
      brandId: continental.id,
      merchantId: ID.merchant.type2,
      price: '950000',
      weight: '9.500',
    },
  ];

  // Дополним до 50 простыми вариациями (для пагинации в каталоге)
  while (products.length < 50) {
    const i = products.length;
    products.push({
      slug: `demo-product-${i}`,
      sku: `DEMO-${String(i).padStart(4, '0')}`,
      nameRu: `Демо-товар №${i}`,
      nameUz: `Demo mahsulot #${i}`,
      categoryId: i % 2 === 0 ? categoryConsum.id : categoryBrake.id,
      brandId: i % 2 === 0 ? bosch.id : mann.id,
      merchantId: i % 2 === 0 ? ID.merchant.type1 : ID.merchant.type2,
      price: String(50000 + i * 5000),
      weight: '0.500',
    });
  }

  for (const p of products) {
    await prisma.product.upsert({
      where: { merchantId_sku: { merchantId: p.merchantId, sku: p.sku } },
      update: {},
      create: {
        merchantId: p.merchantId,
        categoryId: p.categoryId,
        brandId: p.brandId,
        sku: p.sku,
        slug: p.slug,
        name: ml(p.nameRu, p.nameUz),
        description: ml(`${p.nameRu} — оригинальная запчасть.`, `${p.nameUz} — original ehtiyot qism.`),
        oemNumber: p.oemNumber,
        price: new Prisma.Decimal(p.price),
        weight: p.weight ? new Prisma.Decimal(p.weight) : null,
        vatRate: new Prisma.Decimal('12'),
        status: ProductStatus.ACTIVE,
        publishedAt: new Date(),
      },
    });
  }

  // Привязка одного товара к Toyota Camry XV40 для демо compatibility
  const brakePadsProduct = await prisma.product.findFirst({
    where: { sku: 'BREMBO-P83024' },
  });
  if (brakePadsProduct) {
    const mod = await prisma.carModification.findUnique({
      where: { id: '40000000-0000-4000-8000-000000000010' },
    });
    if (mod) {
      // Используем составной upsert вручную (нет уникального индекса)
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

  console.log(`  • products: ${products.length}, +1 compatibility link`);
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
