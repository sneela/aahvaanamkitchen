'use client';

import { useEffect, useState } from 'react';
import { whatsappLink, whatsappOrderMessage, type OrderForWhatsApp } from '@/lib/whatsapp-order';

/** Opens WhatsApp Web or the app with an editable draft; never sends on its own. */
export default function WhatsAppActions({ order }: { order: OrderForWhatsApp }) {
  const [draft, setDraft] = useState(() => whatsappOrderMessage(order));
  useEffect(() => {
    // Reset the draft when the administrator saves a new order status or note.
    setDraft(whatsappOrderMessage(order));
  }, [
    order.order_number, order.customer_name, order.customer_phone,
    order.status, order.status_comment, order.requested_date,
    order.requested_time, order.fulfillment, order.total_cents, order.order_items,
  ]);

  const chat = whatsappLink(order.customer_phone);
  const prepared = whatsappLink(order.customer_phone, draft);

  if (!chat) {
    return <p className="admin-inline-error">WhatsApp unavailable: customer phone number needs a valid international format.</p>;
  }

  return <div className="admin-whatsapp-panel">
    <h4>WhatsApp customer</h4>
    <div className="admin-whatsapp-buttons">
      <a className="admin-wa-primary" href={prepared || chat} target="_blank" rel="noopener noreferrer">
        Open WhatsApp with message ↗
      </a>
      <a className="admin-action" href={chat} target="_blank" rel="noopener noreferrer">
        Open chat only ↗
      </a>
    </div>
    <details className="admin-whatsapp-edit">
      <summary>Preview / edit WhatsApp message</summary>
      <label htmlFor={'whatsapp-draft-' + order.order_number}>Message to {order.customer_name}</label>
      <textarea
        id={'whatsapp-draft-' + order.order_number}
        maxLength={4000}
        rows={10}
        value={draft}
        onChange={event => setDraft(event.target.value)}
      />
      <button className="admin-action" type="button" onClick={() => setDraft(whatsappOrderMessage(order))}>
        Reset to saved order status
      </button>
    </details>
    <small>Uses the order’s saved status. WhatsApp opens a chat with a draft; review it and press Send in WhatsApp. No API fees or automatic sending.</small>
  </div>;
}
