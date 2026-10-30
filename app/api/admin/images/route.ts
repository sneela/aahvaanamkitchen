import { NextResponse, type NextRequest } from 'next/server';
import { Binary } from 'mongodb';
import { requireAdmin } from '@/lib/auth/session';
import { validateSameOrigin, AccessError, jsonError } from '@/lib/api';
import { mongoDb } from '@/lib/mongodb/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The admin UI shrinks phone photos before upload to keep Atlas M0 storage small.
const MAX_IMAGE_BYTES = 1_500_000;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 100_000;
function verifiedType(bytes: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    validateSameOrigin(request);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;'))
      throw new AccessError(415, 'Image upload must use multipart/form-data');
    const length = Number(request.headers.get('content-length') || 0);
    if (length && (!Number.isFinite(length) || length > MAX_REQUEST_BYTES))
      throw new AccessError(413, 'Image upload is too large (maximum 1.5 MB)');
    const form = await request.formData();
    const file = form.get('image');
    if (!(file instanceof File)) throw new AccessError(400, 'Please choose an image');
    if (!file.size || file.size > MAX_IMAGE_BYTES) throw new AccessError(413, 'Please upload an image smaller than 1.5 MB');
    const bytes = Buffer.from(await file.arrayBuffer());
    const detected = verifiedType(bytes);
    if (!detected || detected !== file.type) throw new AccessError(415, 'Only genuine JPEG, PNG or WebP images are supported');
    const db = await mongoDb();
    const result = await db.collection('product_images').insertOne({
      mime_type: detected,
      data: new Binary(bytes),
      size_bytes: bytes.length,
      created_at: new Date(),
    });
    return NextResponse.json({ image_url: '/api/images/' + result.insertedId.toHexString() }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) { return jsonError(error, 'Unable to upload product photo'); }
}
