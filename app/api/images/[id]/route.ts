import { NextResponse } from 'next/server';
import { Binary, ObjectId } from 'mongodb';
import { mongoDb } from '@/lib/mongodb/client';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return new NextResponse('Image not found', { status: 404 });
  try {
    const db = await mongoDb();
    const doc = await db.collection<{ mime_type: string; data: Binary }>('product_images')
      .findOne({ _id: new ObjectId(id) });
    if (!doc || !['image/jpeg','image/png','image/webp'].includes(doc.mime_type))
      return new NextResponse('Image not found', { status: 404 });
    const bytes = doc.data.buffer;
    const responseBody = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(responseBody).set(bytes);
    return new NextResponse(responseBody, {
      headers: {
        'Content-Type': doc.mime_type,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Product image read failed', error);
    return new NextResponse('Image unavailable', { status: 503 });
  }
}
