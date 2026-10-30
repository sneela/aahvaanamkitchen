import type { ObjectId } from 'mongodb';
export const defaultSettings = {
  _id: 'store', ordering_enabled: false, delivery_enabled: false,
  delivery_minimum_cents: 0, default_delivery_fee_cents: 0,
  minimum_notice_hours: 2, default_preorder_notice_hours: 24, max_advance_days: 30,
  whatsapp_number: '12162364062', service_area_description: 'Greater Cleveland, Ohio',
};
export type SettingsDoc = typeof defaultSettings;
export interface ProductDoc {
  _id?: ObjectId; slug: string; name: string; description: string;
  category_id: string | null; price_cents: number; unit_label: string;
  image_url: string | null; is_available: boolean; requires_preorder: boolean;
  preorder_notice_hours: number; is_vegetarian: boolean | null; sort_order: number;
}
export interface OrderDoc {
  _id?: ObjectId; client_request_id: string; order_number: number;
  customer_name: string; customer_phone: string; fulfillment: 'pickup'|'delivery';
  requested_date: string; requested_time: string; delivery_address: string | null;
  customer_notes: string; status: string; payment_status: string;
  subtotal_cents: number; delivery_fee_cents: number; total_cents: number;
  order_items: Array<{product_name_snapshot:string;quantity:number;unit_price_cents:number;line_total_cents:number}>;
  created_at: Date; updated_at: Date;
}
export const serialize = <T extends { _id?: ObjectId }>(doc: T) => {
  const { _id, ...rest } = doc;
  return { id: _id?.toHexString(), ...rest };
};
