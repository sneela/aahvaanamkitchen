/**
 * Client-side WhatsApp click-to-chat URLs; these only prepare a draft.
 * The administrator must explicitly press Send in WhatsApp.
 */
export type OrderForWhatsApp = {
  order_number: number;
  customer_name: string;
  customer_phone: string;
  status: string;
  status_comment?: string;
  fulfillment: 'pickup' | 'delivery';
  requested_date: string;
  requested_time: string;
  total_cents: number;
  order_items: Array<{
    product_name_snapshot: string;
    quantity: number;
    line_total_cents: number;
  }>;
};

const price = (cents: number) => '$' + (cents / 100).toFixed(2);

/** US domestic 10-digit numbers get country code 1; other numbers must already include a country code. */
export function whatsappPhone(raw: string): string | null {
  const value = raw.trim();
  if (!/^[+\d().\s-]{7,30}$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return '1' + digits;
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith('0')) return digits;
  return null;
}

export function whatsappLink(rawPhone: string, message?: string): string | null {
  const phone = whatsappPhone(rawPhone);
  if (!phone) return null;
  const base = 'https://wa.me/' + phone;
  return message?.trim() ? base + '?text=' + encodeURIComponent(message.trim()) : base;
}

/** Message is based on the SAVED status, not an unsaved admin form selection. */
export function whatsappOrderMessage(order: OrderForWhatsApp): string {
  const statusText: Record<string, string> = {
    pending: 'We received your order request and are reviewing it. It is not confirmed yet.',
    accepted: 'Your order has been confirmed!',
    rejected: 'We are sorry, but we are unable to accept your order.',
    preparing: 'Your order is being prepared.',
    ready_for_pickup: 'Your order is ready for pickup.',
    out_for_delivery: 'Your order is out for delivery.',
    completed: 'Your order has been completed. Thank you!',
    cancelled: 'Your order has been cancelled.',
  };
  const name = order.customer_name.trim().split(/\s+/)[0] || 'there';
  const items = order.order_items.map(item =>
    '- ' + item.quantity + ' x ' + item.product_name_snapshot + ' — ' + price(item.line_total_cents),
  );
  const note = order.status_comment?.trim();
  return [
    'Hi ' + name + ',',
    '',
    'Aahvaanam Kitchen — order #' + order.order_number,
    statusText[order.status] || 'Here is an update about your order.',
    ...(note ? ['', 'Kitchen note: ' + note] : []),
    '',
    'Items:',
    ...items,
    '',
    'Total: ' + price(order.total_cents),
    'Requested ' + order.fulfillment + ': ' + order.requested_date + ' at ' + order.requested_time + ' ET',
    '',
    'Thank you for choosing Aahvaanam Kitchen!',
  ].join('\n');
}
