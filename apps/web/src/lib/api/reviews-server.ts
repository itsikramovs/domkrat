// Серверный фетч отзывов (без 'use client', чтобы page.tsx server component
// мог импортировать). Клиентские хуки — в reviews.ts.

import { serverApi } from '@/lib/api-client';

export interface ReviewSummary {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title: string | null;
  comment: string | null;
  pros: string | null;
  cons: string | null;
  merchantReply: string | null;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  user: { firstName: string | null; lastName: string | null };
}

export function fetchProductReviews(slug: string): Promise<ReviewSummary[]> {
  return serverApi()<ReviewSummary[]>(`/products/${slug}/reviews`).catch(() => []);
}
