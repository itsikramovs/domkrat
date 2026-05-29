// Минимальные типы ответов API (mirror того, что возвращает Nest).
// Полноценные shared-types — задача Sprint 2+.

export interface MultiLangText {
  ru: string;
  uz: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: MultiLangText;
  slug: string;
  iconUrl: string | null;
  imageUrl: string | null;
  level: number;
  position: number;
  isActive: boolean;
  children?: Category[];
}

export interface MerchantSummary {
  id: string;
  brandName: string;
  slug: string;
}

export interface ProductImage {
  url: string;
  thumbnailUrl: string | null;
}

export interface Product {
  id: string;
  merchantId: string;
  categoryId: string;
  brandId: string | null;
  sku: string;
  slug: string;
  name: MultiLangText;
  description?: MultiLangText | null;
  shortDescription?: MultiLangText | null;
  oemNumber: string | null;
  price: string;
  compareAtPrice: string | null;
  vatRate: string;
  rating: string;
  reviewsCount: number;
  isFeatured: boolean;
  isOnSale: boolean;
  isNew: boolean;
  status: string;
  images: ProductImage[];
  brand: Brand | null;
  category: Pick<Category, 'id' | 'name' | 'slug'>;
  merchant: MerchantSummary;
}

export interface Banner {
  id: string;
  title: MultiLangText;
  subtitle: MultiLangText | null;
  imageUrlDesktop: string;
  imageUrlMobile: string | null;
  linkUrl: string | null;
  position: 'HOME_MAIN' | 'HOME_SECONDARY' | 'CATEGORY_TOP' | 'SIDEBAR';
  sortOrder: number;
  category: Pick<Category, 'id' | 'name' | 'slug'> | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  priceAtAdded: string;
  product: Pick<Product, 'id' | 'sku' | 'slug' | 'name' | 'price' | 'vatRate' | 'merchantId'> & {
    images: ProductImage[];
  };
}

export interface Cart {
  id: string;
  userId: string;
  currency: string;
  itemsCount: number;
  items: CartItem[];
  promo: {
    code: string;
    valid: boolean;
    reason: string | null;
    message: string | null;
    discount: string;
  } | null;
  pricing: {
    subtotal: string;
    vatAmount: string;
    discount: string;
    deliveryCost: string;
    total: string;
  };
}

export interface UserAddress {
  id: string;
  title: string | null;
  recipientName: string;
  recipientPhone: string;
  region: string;
  city: string;
  district: string | null;
  addressLine: string;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
  isLegalEntity?: boolean;
  companyName?: string | null;
  taxId?: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  status: string;
  productSnapshot: {
    sku: string;
    name: MultiLangText;
    slug: string;
    price: string;
    oemNumber: string | null;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: string;
  vatAmount: string;
  deliveryCost: string;
  totalAmount: string;
  paidAmount: string;
  paymentMethod: string;
  deliveryMethod: string;
  placedAt: string;
  paidAt: string | null;
  items: OrderItem[];
  subOrders: Array<{
    id: string;
    subOrderNumber: string;
    merchantId: string;
    status: string;
    subtotal: string;
    fulfillmentType: string;
  }>;
}
