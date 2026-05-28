/**
 * Event names + payloads для @nestjs/event-emitter.
 * Все события эмитятся ПОСЛЕ commit-а транзакции, чтобы listener'ы не
 * пытались работать с откатывемыми данными.
 */

export const OrderEvents = {
  Created: 'order.created',
  Paid: 'order.paid',
  Completed: 'order.completed',
  Cancelled: 'order.cancelled',
} as const;

export const SubOrderEvents = {
  Shipped: 'sub_order.shipped',
} as const;

export const MerchantEvents = {
  Approved: 'merchant.approved',
  Rejected: 'merchant.rejected',
} as const;

export const WithdrawalEvents = {
  Requested: 'withdrawal.requested',
  Approved: 'withdrawal.approved',
  Completed: 'withdrawal.completed',
  Rejected: 'withdrawal.rejected',
} as const;

// Payloads — минимальный набор полей. Listener'ы догружают остальное через Prisma.
export interface OrderEventPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
}

export interface SubOrderEventPayload {
  subOrderId: string;
  subOrderNumber: string;
  orderId: string;
  merchantId: string;
}

export interface WithdrawalEventPayload {
  withdrawalId: string;
  requestNumber: string;
  merchantId: string;
  amount: string;
}

export interface MerchantApprovedPayload {
  merchantId: string;
  brandName: string;
}
