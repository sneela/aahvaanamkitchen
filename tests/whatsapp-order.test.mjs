import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappPhone, whatsappLink, whatsappOrderMessage } from '../lib/whatsapp-order.ts';

const order = {
  order_number: 104,
  customer_name: 'Sample Customer',
  customer_phone: '(216) 555-0123',
  status: 'pending',
  status_comment: '',
  fulfillment: 'pickup',
  requested_date: '2026-11-01',
  requested_time: '17:30',
  total_cents: 3500,
  order_items: [
    { product_name_snapshot: 'Jowar Roti', quantity: 2, line_total_cents: 2000 },
    { product_name_snapshot: 'Chicken Curry', quantity: 1, line_total_cents: 1500 },
  ],
};

test('US phone numbers are normalized to WhatsApp international format', () => {
  assert.equal(whatsappPhone('(216) 555-0123'), '12165550123');
  assert.equal(whatsappPhone('+1 (216) 555-0123'), '12165550123');
  assert.equal(whatsappPhone('12165550123'), '12165550123');
  assert.equal(whatsappPhone('+44 7911 123456'), '447911123456');
  assert.equal(whatsappPhone('555'), null);
  assert.equal(whatsappPhone('invalid'), null);
});

test('click-to-chat URL opens a specific phone and safely encodes draft message', () => {
  const chat = whatsappLink(order.customer_phone);
  assert.equal(chat, 'https://wa.me/12165550123');
  const message = "Hi! Order #104\nThanks & see you soon";
  const url = whatsappLink(order.customer_phone, message);
  assert.ok(url);
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'wa.me');
  assert.equal(parsed.pathname, '/12165550123');
  assert.equal(parsed.searchParams.get('text'), message);
  assert.equal(whatsappLink('no phone', message), null);
});

test('pending message never claims the kitchen has accepted the order', () => {
  const text = whatsappOrderMessage(order);
  assert.match(text, /pending|not confirmed yet|reviewing/i);
  assert.match(text, /#104/);
  assert.match(text, /2 x Jowar Roti/);
  assert.match(text, /1 x Chicken Curry/);
  assert.match(text, /\$35\.00/);
  assert.match(text, /2026-11-01 at 17:30 ET/);
});

test('confirmation, rejection, delivery and kitchen comments are reflected in drafts', () => {
  assert.match(whatsappOrderMessage({ ...order, status: 'accepted', status_comment: 'Pickup at 5:30 PM' }), /confirmed/i);
  assert.match(whatsappOrderMessage({ ...order, status: 'accepted', status_comment: 'Pickup at 5:30 PM' }), /Kitchen note: Pickup at 5:30 PM/);
  assert.match(whatsappOrderMessage({ ...order, status: 'rejected', status_comment: 'Sold out' }), /unable to accept/i);
  assert.match(whatsappOrderMessage({ ...order, status: 'ready_for_pickup' }), /ready for pickup/i);
  assert.match(whatsappOrderMessage({ ...order, status: 'out_for_delivery' }), /out for delivery/i);
});
