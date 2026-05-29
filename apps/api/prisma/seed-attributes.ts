/**
 * Идемпотентный сид характеристик (атрибутов) по категориям + бэкфилл значений
 * для существующих товаров (по эвристике из названия). Безопасно запускать повторно:
 *   pnpm --filter @domkrat/api exec tsx prisma/seed-attributes.ts
 *
 * НЕ удаляет товары/заказы — только upsert'ит атрибуты и их значения.
 */
import { AttributeDataType, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type ML = { ru: string; uz: string };
const ml = (ru: string, uz: string): ML => ({ ru, uz });

// --------------------------------------------------------------------------- groups
const GROUPS: Array<{ slug: string; name: ML; position: number }> = [
  { slug: 'general', name: ml('Основные характеристики', 'Asosiy xususiyatlar'), position: 0 },
  { slug: 'dimensions', name: ml('Размеры', "O'lchamlar"), position: 1 },
  { slug: 'tire', name: ml('Параметры шины', 'Shina parametrlari'), position: 2 },
  { slug: 'battery', name: ml('Аккумулятор', 'Akkumulyator'), position: 3 },
];

type EnumOpt = { value: string; ru: string; uz: string };
type AttrDef = {
  slug: string;
  name: ML;
  dataType: AttributeDataType;
  unit?: string;
  group: string;
  categories: string[];
  isRequired?: boolean;
  isFilterable?: boolean;
  enums?: EnumOpt[];
};

const e = (value: string, ru: string, uz: string): EnumOpt => ({ value, ru, uz });

// --------------------------------------------------------------------------- attributes
const ATTRS: AttrDef[] = [
  // ---- fluids (Моторные масла / жидкости) ----
  {
    slug: 'fluid-type',
    name: ml('Тип жидкости', 'Suyuqlik turi'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['fluids'],
    isFilterable: true,
    isRequired: true,
    enums: [
      e('motor-oil', 'Моторное масло', 'Motor moyi'),
      e('gear-oil', 'Трансмиссионное масло', 'Transmissiya moyi'),
      e('antifreeze', 'Антифриз / ОЖ', 'Antifriz'),
      e('brake-fluid', 'Тормозная жидкость', 'Tormoz suyuqligi'),
    ],
  },
  {
    slug: 'oil-viscosity',
    name: ml('Вязкость SAE', 'SAE yopishqoqligi'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['fluids'],
    isFilterable: true,
    enums: ['0W-20', '5W-30', '5W-40', '10W-40', '15W-40', '10W-60', '75W-90', '80W-90'].map((v) =>
      e(v, v, v),
    ),
  },
  {
    slug: 'oil-base',
    name: ml('Основа', 'Asosi'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['fluids'],
    isFilterable: true,
    enums: [
      e('synthetic', 'Синтетическое', 'Sintetik'),
      e('semi-synthetic', 'Полусинтетическое', 'Yarim sintetik'),
      e('mineral', 'Минеральное', 'Mineral'),
    ],
  },
  {
    slug: 'fluid-volume',
    name: ml('Объём', 'Hajmi'),
    dataType: 'NUMBER',
    unit: 'л',
    group: 'dimensions',
    categories: ['fluids'],
    isFilterable: true,
  },

  // ---- tires-and-wheels (Шины и диски) ----
  {
    slug: 'wheel-product-type',
    name: ml('Тип товара', 'Mahsulot turi'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['tires-and-wheels'],
    isFilterable: true,
    isRequired: true,
    enums: [
      e('tire', 'Шина', 'Shina'),
      e('alloy-wheel', 'Литой диск', 'Quyma disk'),
      e('hubcap', 'Колпак', 'Qopqoq'),
      e('bolts', 'Болты / гайки', 'Boltlar'),
      e('tpms', 'Датчик давления (TPMS)', 'TPMS datchigi'),
    ],
  },
  {
    slug: 'tire-season',
    name: ml('Сезон', 'Mavsum'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['tires-and-wheels'],
    isFilterable: true,
    enums: [
      e('summer', 'Летние', 'Yozgi'),
      e('winter', 'Зимние', 'Qishki'),
      e('all-season', 'Всесезонные', 'Hamma fasl'),
    ],
  },
  {
    slug: 'tire-width',
    name: ml('Ширина', 'Kengligi'),
    dataType: 'NUMBER',
    unit: 'мм',
    group: 'tire',
    categories: ['tires-and-wheels'],
    isFilterable: true,
  },
  {
    slug: 'tire-profile',
    name: ml('Профиль', 'Profil'),
    dataType: 'NUMBER',
    unit: '%',
    group: 'tire',
    categories: ['tires-and-wheels'],
    isFilterable: true,
  },
  {
    slug: 'tire-diameter',
    name: ml('Посадочный диаметр', "O'rnatish diametri"),
    dataType: 'NUMBER',
    unit: 'R',
    group: 'tire',
    categories: ['tires-and-wheels'],
    isFilterable: true,
  },

  // ---- consumables (Расходники) ----
  {
    slug: 'consumable-type',
    name: ml('Тип расходника', 'Sarf turi'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['consumables'],
    isFilterable: true,
    isRequired: true,
    enums: [
      e('air-filter', 'Воздушный фильтр', 'Havo filtri'),
      e('oil-filter', 'Масляный фильтр', "Yog' filtri"),
      e('cabin-filter', 'Салонный фильтр', 'Salon filtri'),
      e('fuel-filter', 'Топливный фильтр', "Yoqilg'i filtri"),
      e('spark-plug', 'Свеча зажигания', 'Uchqun shami'),
      e('wiper-blade', 'Щётка стеклоочистителя', 'Tozalagich'),
      e('lamp', 'Лампа', 'Lampa'),
      e('floor-mat', 'Коврики', 'Gilamchalar'),
    ],
  },

  // ---- brake-system (Тормозная система) ----
  {
    slug: 'brake-part-type',
    name: ml('Тип детали', 'Detal turi'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['brake-system'],
    isFilterable: true,
    isRequired: true,
    enums: [
      e('pads', 'Колодки', 'Kolodkalar'),
      e('disc', 'Тормозной диск', 'Tormoz diski'),
      e('drum', 'Барабан', 'Baraban'),
      e('caliper', 'Суппорт', 'Support'),
      e('hose', 'Шланг', 'Shlang'),
      e('master-cylinder', 'Главный цилиндр', 'Asosiy silindr'),
      e('cable', 'Трос', 'Tros'),
      e('reservoir', 'Бачок', 'Idish'),
    ],
  },
  {
    slug: 'brake-axle',
    name: ml('Ось', "O'q"),
    dataType: 'ENUM',
    group: 'general',
    categories: ['brake-system', 'suspension'],
    isFilterable: true,
    enums: [e('front', 'Передняя', 'Old'), e('rear', 'Задняя', 'Orqa')],
  },

  // ---- engine-parts (Двигатель) ----
  {
    slug: 'engine-part-type',
    name: ml('Тип детали', 'Detal turi'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['engine-parts'],
    isFilterable: true,
    isRequired: true,
    enums: [
      e('timing-belt', 'Ремень ГРМ', 'Taqsimlash kamari'),
      e('tensioner', 'Натяжитель', 'Tortgich'),
      e('water-pump', 'Помпа', 'Nasos'),
      e('gasket', 'Прокладка', 'Zichlama'),
      e('seal', 'Сальник', 'Zichlagich'),
      e('piston-rings', 'Поршневые кольца', 'Piston halqalari'),
      e('head-bolts', 'Болты ГБЦ', 'GBC boltlari'),
      e('mount', 'Опора двигателя', 'Dvigatel tayanchi'),
      e('ignition-coil', 'Катушка зажигания', "G'altak"),
      e('thermostat', 'Термостат', 'Termostat'),
    ],
  },

  // ---- electrical (Электрика) ----
  {
    slug: 'electrical-part-type',
    name: ml('Тип детали', 'Detal turi'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['electrical'],
    isFilterable: true,
    isRequired: true,
    enums: [
      e('battery', 'Аккумулятор', 'Akkumulyator'),
      e('starter', 'Стартер', 'Starter'),
      e('alternator', 'Генератор', 'Generator'),
      e('sensor', 'Датчик', 'Datchik'),
      e('relay', 'Реле', 'Rele'),
      e('lamp', 'Лампа', 'Lampa'),
      e('wire', 'Провода', 'Simlar'),
      e('fuse', 'Предохранитель', 'Saqlagich'),
    ],
  },
  {
    slug: 'battery-capacity',
    name: ml('Ёмкость', "Sig'imi"),
    dataType: 'NUMBER',
    unit: 'А·ч',
    group: 'battery',
    categories: ['electrical'],
    isFilterable: true,
  },
  {
    slug: 'battery-cca',
    name: ml('Пусковой ток', 'Ishga tushirish toki'),
    dataType: 'NUMBER',
    unit: 'A',
    group: 'battery',
    categories: ['electrical'],
  },

  // ---- suspension (Подвеска и рулевое) ----
  {
    slug: 'suspension-part-type',
    name: ml('Тип детали', 'Detal turi'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['suspension'],
    isFilterable: true,
    isRequired: true,
    enums: [
      e('shock', 'Амортизатор / стойка', 'Amortizator'),
      e('spring', 'Пружина', 'Prujina'),
      e('bushing', 'Сайлентблок / втулка', 'Saylentblok'),
      e('ball-joint', 'Шаровая опора', 'Sharli tayanch'),
      e('tie-rod', 'Рулевой наконечник', 'Rul uchi'),
      e('steering-rack', 'Рулевая рейка', 'Rul reykasi'),
      e('wheel-bearing', 'Ступичный подшипник', 'Podshipnik'),
      e('cv-joint', 'ШРУС', 'SHRUS'),
    ],
  },

  // ---- body-parts (Кузовные) ----
  {
    slug: 'body-part-type',
    name: ml('Тип детали', 'Detal turi'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['body-parts'],
    isFilterable: true,
    isRequired: true,
    enums: [
      e('headlight', 'Фара', 'Fara'),
      e('bumper', 'Бампер', 'Bamper'),
      e('hood', 'Капот', 'Kapot'),
      e('fender', 'Крыло', 'Qanot'),
      e('mirror', 'Зеркало', "Ko'zgu"),
      e('grille', 'Решётка', 'Panjara'),
      e('glass', 'Стекло', 'Oyna'),
      e('moulding', 'Молдинг / накладка', 'Molding'),
      e('tail-light', 'Задний фонарь', 'Orqa chiroq'),
    ],
  },
  {
    slug: 'body-side',
    name: ml('Сторона', 'Tomon'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['body-parts'],
    isFilterable: true,
    enums: [
      e('left', 'Левая', 'Chap'),
      e('right', 'Правая', "O'ng"),
      e('front', 'Передняя', 'Old'),
      e('rear', 'Задняя', 'Orqa'),
    ],
  },

  // ---- interior (Салон и чехлы) ----
  {
    slug: 'interior-material',
    name: ml('Материал', 'Material'),
    dataType: 'ENUM',
    group: 'general',
    categories: ['interior'],
    isFilterable: true,
    enums: [
      e('textile', 'Текстиль', 'Mato'),
      e('eco-leather', 'Экокожа', 'Ekokoja'),
      e('leather', 'Натуральная кожа', 'Tabiiy charm'),
      e('eva', 'EVA', 'EVA'),
    ],
  },
];

// --------------------------------------------------------------------------- seed structure
async function seedDefinitions(catBySlug: Record<string, string>) {
  const groupBySlug: Record<string, string> = {};
  for (const g of GROUPS) {
    const row = await prisma.attributeGroup.upsert({
      where: { slug: g.slug },
      update: { name: g.name as unknown as Prisma.InputJsonValue, position: g.position },
      create: {
        slug: g.slug,
        name: g.name as unknown as Prisma.InputJsonValue,
        position: g.position,
      },
    });
    groupBySlug[g.slug] = row.id;
  }

  const attrIdBySlug: Record<string, string> = {};
  let pos = 0;
  for (const a of ATTRS) {
    const categoryIds = a.categories.map((s) => catBySlug[s]).filter(Boolean);
    const enumValues = a.enums?.map((o) => ({ value: o.value, label: ml(o.ru, o.uz) })) ?? null;
    const data = {
      name: a.name as unknown as Prisma.InputJsonValue,
      dataType: a.dataType,
      unit: a.unit ?? null,
      attributeGroupId: groupBySlug[a.group],
      categoryIds,
      isFilterable: a.isFilterable ?? false,
      isRequired: a.isRequired ?? false,
      isSearchable: false,
      position: pos++,
      enumValues: (enumValues ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    };
    const row = await prisma.attribute.upsert({
      where: { slug: a.slug },
      update: data,
      create: { slug: a.slug, ...data },
    });
    attrIdBySlug[a.slug] = row.id;
  }
  return attrIdBySlug;
}

// --------------------------------------------------------------------------- backfill
const has = (s: string, ...words: string[]) =>
  words.some((w) => s.toLowerCase().includes(w.toLowerCase()));

function detect(name: string, rules: Array<[string, string[]]>): string | null {
  for (const [code, words] of rules) if (has(name, ...words)) return code;
  return null;
}

/** Возвращает значения характеристик для одного товара по его названию и категории. */
function inferValues(slug: string, name: string): Record<string, string | number | string[]> {
  const out: Record<string, string | number | string[]> = {};
  switch (slug) {
    case 'fluids': {
      out['fluid-type'] =
        detect(name, [
          ['gear-oil', ['трансмисси', 'акпп', 'atf']],
          ['antifreeze', ['антифриз', 'охлажд', 'тосол']],
          ['brake-fluid', ['тормозная жидкость', 'dot']],
          ['motor-oil', ['масло моторное', 'моторное']],
        ]) ?? 'motor-oil';
      const visc = name.match(/(\d+W-\d+)/i);
      if (visc) out['oil-viscosity'] = visc[1].toUpperCase();
      if (has(name, 'синтет')) out['oil-base'] = 'synthetic';
      else if (has(name, 'полусинтет')) out['oil-base'] = 'semi-synthetic';
      else if (has(name, 'минерал')) out['oil-base'] = 'mineral';
      const vol = name.match(/(\d+(?:[.,]\d+)?)\s*л(?![а-яёa-z])/i);
      if (vol) out['fluid-volume'] = Number(vol[1].replace(',', '.'));
      break;
    }
    case 'tires-and-wheels': {
      const type =
        detect(name, [
          ['alloy-wheel', ['литой диск', 'диск replica', 'диск ']],
          ['hubcap', ['колпак']],
          ['bolts', ['болты', 'гайки']],
          ['tpms', ['tpms', 'давления шин']],
          ['tire', ['шин']],
        ]) ?? 'tire';
      out['wheel-product-type'] = type;
      if (type === 'tire') {
        if (has(name, 'зимн')) out['tire-season'] = 'winter';
        else if (has(name, 'летн')) out['tire-season'] = 'summer';
        else if (has(name, 'всесезон')) out['tire-season'] = 'all-season';
        const m = name.match(/(\d{3})\/(\d{2})\s*R\s*(\d{2})/i);
        if (m) {
          out['tire-width'] = Number(m[1]);
          out['tire-profile'] = Number(m[2]);
          out['tire-diameter'] = Number(m[3]);
        }
      }
      break;
    }
    case 'consumables': {
      const t = detect(name, [
        ['air-filter', ['воздушный фильтр']],
        ['oil-filter', ['масляный фильтр']],
        ['cabin-filter', ['салонный фильтр']],
        ['fuel-filter', ['топливный фильтр']],
        ['spark-plug', ['свеч']],
        ['wiper-blade', ['щётк', 'стеклоочист']],
        ['lamp', ['лампа']],
        ['floor-mat', ['коврик']],
      ]);
      if (t) out['consumable-type'] = t;
      break;
    }
    case 'brake-system': {
      const t = detect(name, [
        ['pads', ['колодки']],
        ['disc', ['тормозной диск', ' диск']],
        ['drum', ['барабан']],
        ['caliper', ['суппорт']],
        ['hose', ['шланг']],
        ['master-cylinder', ['цилиндр']],
        ['cable', ['трос']],
        ['reservoir', ['бачок']],
      ]);
      if (t) out['brake-part-type'] = t;
      if (has(name, 'передн')) out['brake-axle'] = 'front';
      else if (has(name, 'задн')) out['brake-axle'] = 'rear';
      break;
    }
    case 'engine-parts': {
      const t = detect(name, [
        ['timing-belt', ['ремень грм']],
        ['tensioner', ['натяжитель']],
        ['water-pump', ['помпа']],
        ['gasket', ['прокладка']],
        ['seal', ['сальник']],
        ['piston-rings', ['кольца']],
        ['head-bolts', ['болты гбц']],
        ['mount', ['опора двигател']],
        ['ignition-coil', ['катушка']],
        ['thermostat', ['термостат']],
      ]);
      if (t) out['engine-part-type'] = t;
      break;
    }
    case 'electrical': {
      const t = detect(name, [
        ['battery', ['аккумулятор']],
        ['starter', ['стартер']],
        ['alternator', ['генератор']],
        ['sensor', ['датчик', 'лямбда']],
        ['relay', ['реле']],
        ['lamp', ['лампа']],
        ['wire', ['провода']],
        ['fuse', ['предохранител']],
      ]);
      if (t) out['electrical-part-type'] = t;
      if (t === 'battery') {
        const ah = name.match(/(\d+)\s*Ah/i);
        if (ah) out['battery-capacity'] = Number(ah[1]);
        const cca = name.match(/(\d{3,4})A\b/);
        if (cca) out['battery-cca'] = Number(cca[1]);
      }
      break;
    }
    case 'suspension': {
      const t = detect(name, [
        ['shock', ['амортизатор', 'стойка']],
        ['spring', ['пружина']],
        ['bushing', ['втулка', 'сайлентблок']],
        ['ball-joint', ['шаровая']],
        ['tie-rod', ['наконечник рулев']],
        ['steering-rack', ['рулевая рейка']],
        ['wheel-bearing', ['подшипник']],
        ['cv-joint', ['шрус']],
      ]);
      if (t) out['suspension-part-type'] = t;
      if (has(name, 'передн')) out['brake-axle'] = 'front';
      else if (has(name, 'задн')) out['brake-axle'] = 'rear';
      break;
    }
    case 'body-parts': {
      const t = detect(name, [
        ['headlight', ['фара']],
        ['bumper', ['бампер']],
        ['hood', ['капот']],
        ['fender', ['крыло']],
        ['mirror', ['зеркало']],
        ['grille', ['решётка']],
        ['glass', ['стекло']],
        ['moulding', ['молдинг', 'накладк']],
        ['tail-light', ['фонарь задн', 'фонарь']],
      ]);
      if (t) out['body-part-type'] = t;
      if (has(name, 'левое', 'левый', 'левая')) out['body-side'] = 'left';
      else if (has(name, 'правое', 'правый', 'правая')) out['body-side'] = 'right';
      else if (has(name, 'передн')) out['body-side'] = 'front';
      else if (has(name, 'задн')) out['body-side'] = 'rear';
      break;
    }
    case 'interior': {
      if (has(name, 'экокож')) out['interior-material'] = 'eco-leather';
      else if (has(name, 'кожа натуральн', 'натуральная кожа'))
        out['interior-material'] = 'leather';
      else if (has(name, 'кожа')) out['interior-material'] = 'eco-leather';
      else if (has(name, 'текстиль', 'тканев')) out['interior-material'] = 'textile';
      else if (has(name, 'eva')) out['interior-material'] = 'eva';
      break;
    }
  }
  return out;
}

const NUMBER_ATTRS = new Set([
  'fluid-volume',
  'tire-width',
  'tire-profile',
  'tire-diameter',
  'battery-capacity',
  'battery-cca',
]);

async function backfillProducts(
  catBySlug: Record<string, string>,
  attrIdBySlug: Record<string, string>,
) {
  const idToSlug = Object.fromEntries(Object.entries(catBySlug).map(([s, id]) => [id, s]));
  const products = await prisma.product.findMany({
    where: { deletedAt: null, categoryId: { in: Object.values(catBySlug) } },
    select: { id: true, slug: true, categoryId: true, name: true },
  });

  let count = 0;
  for (const p of products) {
    const catSlug = idToSlug[p.categoryId];
    if (!catSlug) continue;
    const nameRu = (p.name as { ru?: string })?.ru ?? '';
    const values = inferValues(catSlug, nameRu);
    for (const [attrSlug, raw] of Object.entries(values)) {
      const attributeId = attrIdBySlug[attrSlug];
      if (!attributeId) continue;
      const data: Prisma.ProductAttributeUncheckedCreateInput = { productId: p.id, attributeId };
      if (NUMBER_ATTRS.has(attrSlug)) data.valueNumber = new Prisma.Decimal(raw as number);
      else if (Array.isArray(raw)) data.valueMultiEnum = raw;
      else data.valueEnum = String(raw);
      await prisma.productAttribute.upsert({
        where: { productId_attributeId: { productId: p.id, attributeId } },
        update: {
          valueNumber: data.valueNumber ?? null,
          valueEnum: data.valueEnum ?? null,
          valueMultiEnum: data.valueMultiEnum ?? [],
        },
        create: data,
      });
      count++;
    }
  }
  return { products: products.length, values: count };
}

async function main() {
  const slugs = [
    'fluids',
    'tires-and-wheels',
    'body-parts',
    'interior',
    'consumables',
    'brake-system',
    'engine-parts',
    'electrical',
    'suspension',
    'accessories',
  ];
  const cats = await prisma.category.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id])) as Record<string, string>;

  console.log('→ seeding attribute groups + attributes…');
  const attrIdBySlug = await seedDefinitions(catBySlug);
  console.log(`  • ${GROUPS.length} groups, ${ATTRS.length} attributes`);

  console.log('→ backfilling product attribute values…');
  const res = await backfillProducts(catBySlug, attrIdBySlug);
  console.log(`  • scanned ${res.products} products, set ${res.values} attribute values`);

  console.log('✓ done');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
