import { NextResponse, type NextRequest } from 'next/server';
import { mongoConfigured, mongoDb } from '@/lib/mongodb/client';
import { type OrderDoc } from '@/lib/mongodb/models';
import { badRequest, int, jsonError, parseBody, str } from '@/lib/api';
import { rateLimit } from '@/lib/mongodb/limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const digits = (phone: string) => {
  const all = phone.replace(/\D/g, '');
  return all.length === 11 && all.startsWith('1') ? all.slice(1) : all;
};

export async function POST(request: NextRequest) {
  try {
    if (!mongoConfigured()) return badRequest('Order tracking is temporarily unavailable', 503);
    const body = await parseBody(request, 1200);
    const orderNumber = int(body.orderNumber, 1, 1000000000);
    const suppliedPhone = str(body.phone, 30);
    const suppliedDigits = digits(suppliedPhone);
    if (orderNumber === null || suppliedDigits.length < 10 || suppliedDigits.length > 15) {
      return badRequest('Enter a valid order number and the phone used for the order');
    }
    // Rate-limit before the database lookup and return the same message for unknown orders
    // and incorrect phone numbers to avoid exposing whether an order exists.
    await rateLimit(request, 'order-status', 10, 15);
    const db = await mongoDb();
    const order = await db.collection<OrderDoc>('orders').findOne({ order_number: orderNumber });
    if (!order || digits(order.customer_phone) !== suppliedDigits) {
      return badRequest('Order not found. Check the order number and phone number.', 404);
    }
    return NextResponse.json({
      order: {
        number: order.order_number,
        status: order.status,
        comment: order.status_comment || '',
        statusUpdatedAt: order.status_updated_at || order.updated_at || order.created_at,
        paymentStatus: order.payment_status,
        fulfillment: order.fulfillment,
        date: order.requested_date,
        time: order.requested_time,
        items: order.order_items.map(i => ({
          name: i.product_name_snapshot, quantity: i.quantity,
          unitPriceCents: i.unit_price_cents, lineTotalCents: i.line_total_cents,
        })),
        subtotalCents: order.subtotal_cents,
        deliveryFeeCents: order.delivery_fee_cents,
        totalCents: order.total_cents,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error, 'Unable to check order status'); }
}
