import { NextResponse, type NextRequest } from 'next/server';
import { mongoConfigured, mongoDb } from '@/lib/mongodb/client';
import { badRequest, jsonError, parseBody, str, int } from '@/lib/api';
import { rateLimit } from '@/lib/mongodb/limits';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    if (!mongoConfigured()) return badRequest('Review form is not connected; please use WhatsApp.', 503);
    const b = await parseBody(request, 4000);
    if (b.website) return badRequest('Request rejected');
    const name = str(b.name, 80), review = str(b.review, 1200), rating = int(b.rating, 1, 5);
    if (name.length < 2 || review.length < 10 || rating === null) return badRequest('Enter a name, rating and review (at least 10 characters)');
    await rateLimit(request, 'review', 2, 60);
    await (await mongoDb()).collection('reviews').insertOne({ customer_display_name: name, rating, review_text: review, is_approved: false, created_at: new Date() });
    return NextResponse.json({ message: 'Thank you! Your review was submitted for approval.' }, { status: 201 });
  } catch (e) { return jsonError(e, 'Unable to submit feedback'); }
}
