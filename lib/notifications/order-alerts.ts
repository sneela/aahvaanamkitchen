import type { OrderDoc } from '@/lib/mongodb/models';

/** Optional merchant-only alerts. Never send credentials or customer contact details to logs. */
const fmt = (cents: number) => '$' + (cents / 100).toFixed(2);
const summarize = (order: OrderDoc) =>
  'New Aahvaanam order #' + order.order_number + '\n' +
  'Customer: ' + order.customer_name + '\nPhone: ' + order.customer_phone + '\n' +
  'Fulfillment: ' + order.fulfillment + '\nRequested: ' +
  order.requested_date + ' ' + order.requested_time + ' Eastern\n' +
  (order.delivery_address ? 'Address: ' + order.delivery_address + '\n' : '') +
  'Items:\n' + order.order_items.map(i => i.quantity + ' x ' + i.product_name_snapshot +
    ' (' + fmt(i.line_total_cents) + ')').join('\n') + '\n' +
  'Total: ' + fmt(order.total_cents) + '\nStatus: Pending confirmation\n' +
  (order.customer_notes ? 'Notes: ' + order.customer_notes + '\n' : '');

async function resendEmail(order: OrderDoc, body: string) {
  const key = process.env.RESEND_API_KEY;
  const sender = process.env.ORDER_ALERT_FROM_EMAIL;
  const recipient = process.env.ORDER_ALERT_EMAIL;
  if (!key || !sender || !recipient) return;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
      'Idempotency-Key': 'aahvaanam-order-' + order.order_number,
    },
    body: JSON.stringify({
      from: sender, to: [recipient],
      subject: 'New Aahvaanam order #' + order.order_number,
      text: body,
    }),
    signal: AbortSignal.timeout(7500),
  });
  if (!response.ok) throw new Error('Email notification rejected (' + response.status + ')');
}
async function twilioMessage(params: URLSearchParams) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return;
  const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' +
    encodeURIComponent(sid) + '/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(), signal: AbortSignal.timeout(7500),
    });
  if (!response.ok) throw new Error('Messaging notification rejected (' + response.status + ')');
}
async function sendSms(order: OrderDoc) {
  const from = process.env.TWILIO_SMS_FROM;
  const to = process.env.ORDER_ALERT_SMS_TO;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !from || !to) return;
  const params = new URLSearchParams({
    From: from, To: to,
    Body: 'Aahvaanam: new order #' + order.order_number + ' (' + fmt(order.total_cents) +
      '), ' + order.order_items.length + ' item type(s). Open the kitchen dashboard to review.',
  });
  await twilioMessage(params);
}
async function sendWhatsApp(order: OrderDoc) {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.ORDER_ALERT_WHATSAPP_TO;
  const contentSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !from || !to || !contentSid) return;
  // Proactive WhatsApp notifications require an approved message template and opted-in recipient.
  const params = new URLSearchParams({
    From: from.startsWith('whatsapp:') ? from : 'whatsapp:' + from,
    To: to.startsWith('whatsapp:') ? to : 'whatsapp:' + to,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify({
      '1': String(order.order_number),
      '2': fmt(order.total_cents),
    }),
  });
  await twilioMessage(params);
}

/** A failed alert must never make a successfully saved order appear to fail. */
export async function notifyOwnerNewOrder(order: OrderDoc): Promise<void> {
  const body = summarize(order);
  const results = await Promise.allSettled([resendEmail(order, body), sendSms(order), sendWhatsApp(order)]);
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      console.error(['Order email', 'Order SMS', 'Order WhatsApp'][index] + ' notification failed:',
        result.reason instanceof Error ? result.reason.message : 'Unknown notification error');
    }
  }
}
