export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export const defaultSettings = {
  _id: 'store' as const, orderingEnabled: false, deliveryEnabled: false,
  deliveryMinimumCents: 0, deliveryFeeCents: 0, minimumNoticeHours: 2,
  defaultPreorderNoticeHours: 24, maxAdvanceDays: 30,
  whatsappNumber: '12162364062', serviceArea: 'Greater Cleveland, Ohio'
};
export interface ProductDocument {
  slug: string; name: string; category: string; description: string;
  priceCents: number; unit: string; available: boolean;
  requiresPreorder: boolean; preorderNoticeHours: number | null;
  image: string | null; vegetarian: boolean | null; sortOrder: number;
}
export interface OrderDocument {
  requestId: string; orderNumber: string; status: OrderStatus; paymentStatus: PaymentStatus;
  customerName: string; customerPhone: string; fulfillment: 'pickup' | 'delivery';
  requestedDate: string; requestedTime: string; deliveryAddress: string | null;
  notes: string; items: Array<{ slug: string; name: string; quantity: number; unitPriceCents: number; lineTotalCents: number }>;
  subtotalCents: number; deliveryFeeCents: number; totalCents: number; createdAt: Date; updatedAt: Date;
}
