import { NextResponse, type NextRequest } from 'next/server';
import { mongoConfigured, mongoDb } from '@/lib/mongodb/client';
import { badRequest, isDate, jsonError, parseBody, str, int } from '@/lib/api';
import { rateLimit } from '@/lib/mongodb/limits';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    if (!mongoConfigured()) return badRequest('Catering form is not connected; please use WhatsApp.', 503);
    const b = await parseBody(request, 5000);
    if (b.website) return badRequest('Request rejected');
    const name = str(b.name, 100), phone = str(b.phone, 30), message = str(b.message, 2000);
    const date = str(b.date, 10), guests = b.guests === '' || b.guests == null ? null : int(b.guests, 1, 10000);
    if (name.length < 2 || !/^[+\d().\s-]{7,30}$/.test(phone) || message.length < 10 || (date && !isDate(date)) || (b.guests !== '' && b.guests != null && guests === null)) return badRequest('Enter valid contact details and an event description');
    await rateLimit(request, 'catering', 3, 60);
    await (await mongoDb()).collection('catering_inquiries').insertOne({ customer_name: name, customer_phone: phone, event_date: date || null, guest_count: guests, message, status: 'new', created_at: new Date() });
    return NextResponse.json({ message: 'Your catering inquiry was received. We will contact you to discuss availability.' }, { status: 201 });
  } catch (e) { return jsonError(e, 'Unable to submit inquiry'); }
}
