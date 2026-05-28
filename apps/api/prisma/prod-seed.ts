// Production seed — только справочники и один super-admin.
// НЕ создаёт тестовых юзеров, мерчантов, товары, склады, инвентарь.
//
// Запуск:
//   SUPER_ADMIN_EMAIL=admin@domkrat.uz \
//   SUPER_ADMIN_PASSWORD='<длинный_рандомный_пароль>' \
//   pnpm --filter @domkrat/api exec tsx prisma/prod-seed.ts
//
// Идемпотентен (upsert). Можно запускать повторно — пароль admin обновится,
// справочники не дублируются.

import {
  DeliveryMethodType,
  FaqStatus,
  NotificationChannel,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient({ log: ['warn', 'error'] });
const ml = (ru: string, uz: string) => ({ ru, uz });

async function main(): Promise<void> {
  console.log('[prod-seed] starting…');

  await seedSuperAdmin();
  await seedCategoriesAndBrands();
  await seedCars();
  await seedDeliveryMethods();
  await seedNotificationTemplates();
  await seedSettingsAndFaq();

  console.log('[prod-seed] done ✓');
}

// ---------------------------------------------------------------------------
async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars are required for prod-seed',
    );
  }
  if (password.length < 16) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 16 characters');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('SUPER_ADMIN_EMAIL must be a valid email address');
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isActive: true, isEmailVerified: true },
    create: {
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
      isEmailVerified: true,
      preferredLanguage: 'ru',
    },
  });

  // Назначаем роли SUPER_ADMIN + ADMIN (compound unique с nullable merchantId)
  for (const role of [UserRole.SUPER_ADMIN, UserRole.ADMIN]) {
    const existing = await prisma.userRoleAssignment.findFirst({
      where: { userId: user.id, role, merchantId: null },
    });
    if (!existing) {
      await prisma.userRoleAssignment.create({ data: { userId: user.id, role } });
    }
  }

  console.log(`  • super admin: ${email}`);
}

// ---------------------------------------------------------------------------
async function seedCategoriesAndBrands(): Promise<void> {
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

  console.log(`  • categories: ${rootCategories.length} root + 4 sub, brands: ${brands.length}`);
}

// ---------------------------------------------------------------------------
async function seedCars(): Promise<void> {
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
    { name: 'Lexus', slug: 'lexus', isPopular: false, countryOfOrigin: 'Japan' },
    { name: 'UAZ', slug: 'uaz', isPopular: false, countryOfOrigin: 'Russia' },
  ];
  for (let i = 0; i < makes.length; i++) {
    const m = makes[i]!;
    await prisma.carMake.upsert({
      where: { slug: m.slug },
      update: { isPopular: m.isPopular, position: i },
      create: { ...m, position: i },
    });
  }
  console.log(`  • car makes: ${makes.length} (модели/поколения наполняются через админку)`);
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
    console.error('[prod-seed] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    void prisma.$disconnect();
  });
