import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId, type Db } from 'mongodb';
import { requireAdmin } from '@/lib/auth/session';
import { mongoDb } from '@/lib/mongodb/client';
import { defaultSettings, serialize, type ProductDoc, type OrderDoc, type SettingsDoc } from '@/lib/mongodb/models';
import { badRequest, bool, int, jsonError, parseBody, str } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const statuses = ['pending','accepted','rejected','preparing','ready_for_pickup','out_for_delivery','completed','cancelled'];
const payments = ['unpaid','paid','refunded'];
const inquiryStatuses = ['new','contacted','closed'];
const isId = (s: string) => /^[a-f0-9]{24}$/i.test(s);
const slugFromName = (name: string, max = 100) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max).replace(/-$/g, '');
/** Remove previous image bytes only when no product still points to them. */
async function cleanupProductPhoto(db: Db, url: string | null | undefined) {
  if (!url || !/^\/api\/images\/[a-f0-9]{24}$/i.test(url)) return;
  try {
    if (!(await db.collection('products').findOne({ image_url: url }))) {
      await db.collection('product_images').deleteOne({ _id: new ObjectId(url.slice(-24)) });
    }
  } catch (error) { console.error('Unable to clean up unused product image', error); }
}
export async function GET() {
  try {
    await requireAdmin();
    const db = await mongoDb();
    const [orders, products, categories, settings, specials, reviews, catering] = await Promise.all([
      db.collection<OrderDoc>('orders').find().sort({ created_at: -1, _id: -1 }).limit(100).toArray(),
      db.collection<ProductDoc>('products').find().sort({ sort_order: 1 }).toArray(),
      db.collection<{ id: string; name: string; sort_order: number; is_active: boolean }>('categories').find().sort({ sort_order: 1 }).toArray(),
      db.collection<SettingsDoc>('settings').findOne({ _id: 'store' }),
      db.collection('specials').find().sort({ created_at: -1 }).limit(100).toArray(),
      db.collection('reviews').find().sort({ created_at: -1 }).limit(100).toArray(),
      db.collection('catering_inquiries').find().sort({ created_at: -1 }).limit(100).toArray(),
    ]);
    return NextResponse.json({ orders: orders.map(serialize), products: products.map(serialize),
      categories: categories.map(c => ({ id: c.id, name: c.name, is_active: c.is_active, sort_order: c.sort_order })), settings: { ...defaultSettings, ...settings },
      specials: specials.map(serialize), reviews: reviews.map(serialize), catering: catering.map(serialize) },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return jsonError(e, 'Unable to load administrator dashboard'); }
}
function productFields(b: Record<string, unknown>, creating: boolean) {
  const data: Record<string, unknown> = {};
  for (const [key,max] of [['name',120],['description',1000],['unit_label',100],['image_url',500],['slug',100]] as const) {
    if (b[key] === undefined) continue;
    if (key === 'image_url' && b[key] === null) { data[key] = null; continue; }
    if (typeof b[key] !== 'string' || b[key].length > max) throw new Error('Invalid '+key);
    const v = str(b[key],max);
    if (key === 'image_url' && v && !/^https:\/\/[^\s]+$/.test(v) && !/^\/images\/[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp)$/.test(v) && !/^\/api\/images\/[a-f0-9]{24}$/.test(v)) throw new Error('Invalid image URL');
    data[key] = v;
  }
  if (b.category_id !== undefined) {
    if (b.category_id !== null && b.category_id !== '' && (typeof b.category_id !== 'string' || !/^[a-z0-9-]{2,80}$/.test(b.category_id))) throw new Error('Invalid category');
    data.category_id = b.category_id || null;
  }
  for (const key of ['price_cents','sort_order','preorder_notice_hours'] as const) {
    if (b[key] === undefined) continue;
    const n = int(b[key],key==='sort_order'?-100000:0,key==='price_cents'?1000000:key==='preorder_notice_hours'?720:100000);
    if (n === null) throw new Error('Invalid '+key);
    data[key] = n;
  }
  for (const key of ['is_available','requires_preorder'] as const) {
    if (b[key] === undefined) continue;
    const v = bool(b[key]); if (v === null) throw new Error('Invalid '+key);
    data[key] = v;
  }
  if (b.is_vegetarian !== undefined) {
    if (b.is_vegetarian !== null && typeof b.is_vegetarian !== 'boolean') throw new Error('Invalid vegetarian flag');
    data.is_vegetarian = b.is_vegetarian;
  }
  if (creating && !data.slug && data.name) data.slug = slugFromName(String(data.name));
  if (creating && (!data.name || !data.slug || data.price_cents === undefined)) throw new Error('Name and price are required, and name must produce a valid slug');
  if (data.slug !== undefined && !/^[a-z0-9-]+$/.test(String(data.slug))) throw new Error('Invalid slug');
  if (data.name !== undefined && !data.name) throw new Error('Name cannot be empty');
  if (data.unit_label !== undefined && !data.unit_label) throw new Error('Unit cannot be empty');
  return data;
}
function settingsFields(b: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const key of ['ordering_enabled','delivery_enabled'] as const) if (b[key] !== undefined) {
    const v = bool(b[key]); if (v === null) throw new Error('Invalid '+key); data[key] = v;
  }
  for (const key of ['delivery_minimum_cents','default_delivery_fee_cents','minimum_notice_hours','default_preorder_notice_hours','max_advance_days'] as const) if (b[key] !== undefined) {
    const v = int(b[key],key==='max_advance_days'?1:0,key==='max_advance_days'?365:key.includes('hours')?720:1000000);
    if (v === null) throw new Error('Invalid '+key); data[key] = v;
  }
  if (b.whatsapp_number !== undefined) {
    const v = str(b.whatsapp_number,20); if (!/^\d{10,15}$/.test(v)) throw new Error('WhatsApp number must be 10-15 digits'); data.whatsapp_number = v;
  }
  if (b.service_area_description !== undefined) {
    const v = str(b.service_area_description,200); if (!v) throw new Error('Service area cannot be blank'); data.service_area_description = v;
  }
  return data;
}
function specialFields(b: Record<string, unknown>, creating: boolean) {
  const data: Record<string, unknown> = {};
  for (const key of ['title','description','image_url'] as const) if (b[key] !== undefined) {
    const max = key==='description'?2000:key==='image_url'?500:120;
    if (key==='image_url' && b[key]===null) { data[key]=null; continue; }
    if (typeof b[key] !== 'string' || b[key].length > max) throw new Error('Invalid '+key);
    const v = str(b[key],max);
    if (key==='image_url' && v && !/^https:\/\/[^\s]+$/.test(v)) throw new Error('Invalid image URL');
    data[key] = v || (key==='image_url'?null:'');
  }
  for (const key of ['starts_at','ends_at'] as const) if (b[key] !== undefined) {
    const v = b[key]; if (v !== null && (typeof v !== 'string' || !Number.isFinite(Date.parse(v)))) throw new Error('Invalid '+key);
    data[key] = v;
  }
  if (b.is_published !== undefined) {
    const v = bool(b.is_published); if (v === null) throw new Error('Invalid publication status'); data.is_published = v;
  }
  if (creating && !data.title) throw new Error('Special title is required');
  return data;
}
async function mutate(request: NextRequest, method: 'POST'|'PATCH'|'DELETE') {
  try {
    await requireAdmin();
    const b = await parseBody(request);
    const resource = str(b.resource,40), id = str(b.id,40);
    const db = await mongoDb();
    let data: Record<string, unknown> = {};
    if (resource === 'product') {
      if (method !== 'POST' && !isId(id)) return badRequest('Invalid product ID');
      const col = db.collection<ProductDoc>('products');
      if (method === 'DELETE') {
        const previous = await col.findOneAndDelete({ _id: new ObjectId(id) });
        if (!previous) return badRequest('Product not found',404);
        await cleanupProductPhoto(db, previous.image_url);
      } else {
        data = productFields(b,method==='POST');
        if (!Object.keys(data).length) return badRequest('No changes');
        if (data.category_id && !(await db.collection('categories').findOne({ id: data.category_id }))) return badRequest('Unknown category',422);
        if (method === 'POST') await col.insertOne({ slug:'',name:'',description:'',category_id:null,price_cents:0,unit_label:'per order',
          image_url:null,is_available:true,requires_preorder:false,preorder_notice_hours:24,is_vegetarian:null,sort_order:100,...data } as ProductDoc);
        else {
          const previous = await col.findOne({ _id: new ObjectId(id) });
          if (!previous) return badRequest('Product not found',404);
          await col.updateOne({ _id: new ObjectId(id) }, { $set: data });
          if (data.image_url !== undefined && data.image_url !== previous.image_url) {
            await cleanupProductPhoto(db, previous.image_url);
          }
        }
      }
    } else if (resource === 'category') {
      const categoryId = method === 'POST' && !b.category_id ? slugFromName(str(b.name, 80), 80) : str(b.category_id, 80);
      if (!/^[a-z0-9-]{2,80}$/.test(categoryId)) return badRequest('Invalid category ID');
      const col = db.collection('categories');
      if (method === 'DELETE') {
        if (await db.collection('products').findOne({ category_id: categoryId })) return badRequest('Move or delete products in this category first', 409);
        if (!(await col.deleteOne({ id: categoryId })).deletedCount) return badRequest('Category not found', 404);
      } else {
        if (b.name !== undefined) {
          const name = str(b.name, 80);
          if (name.length < 2) return badRequest('Category name must have at least 2 characters');
          data.name = name;
        }
        if (b.sort_order !== undefined) {
          const sortOrder = int(b.sort_order, -100000, 100000);
          if (sortOrder === null) return badRequest('Invalid category sort order');
          data.sort_order = sortOrder;
        }
        if (b.is_active !== undefined) {
          const active = bool(b.is_active);
          if (active === null) return badRequest('Invalid category availability');
          data.is_active = active;
        }
        if (method === 'POST') {
          if (!data.name) return badRequest('Category name is required');
          await col.insertOne({ id: categoryId, name: data.name, is_active: data.is_active ?? true, sort_order: data.sort_order ?? 100 });
        } else {
          if (!Object.keys(data).length) return badRequest('No changes');
          if (!(await col.updateOne({ id: categoryId }, { $set: data })).matchedCount) return badRequest('Category not found', 404);
        }
      }
    } else if (resource === 'settings' && method === 'PATCH') {
      data = settingsFields(b); if (!Object.keys(data).length) return badRequest('No changes');
      await db.collection('settings').updateOne({ _id: 'store' as never }, { $set: data }, { upsert:true });
    } else if (resource === 'order' && method === 'PATCH') {
      if (!isId(id)) return badRequest('Invalid order ID');
      if (b.status !== undefined) {
        if (!statuses.includes(String(b.status))) return badRequest('Invalid order status');
        data.status = b.status;
      }
      if (b.payment_status !== undefined) {
        if (!payments.includes(String(b.payment_status))) return badRequest('Invalid payment status');
        data.payment_status = b.payment_status;
      }
      if (b.status_comment !== undefined) {
        if (typeof b.status_comment !== 'string' || b.status_comment.length > 1000) return badRequest('Invalid customer comment');
        data.status_comment = b.status_comment.trim();
      }
      if (data.status === 'rejected' && !data.status_comment) return badRequest('Add an explanation before rejecting an order',422);
      if (!Object.keys(data).length) return badRequest('No changes');
      const timestamp = new Date();
      if (data.status !== undefined || data.status_comment !== undefined) data.status_updated_at = timestamp;
      if (!(await db.collection('orders').updateOne({ _id: new ObjectId(id) }, { $set: { ...data, updated_at: timestamp } })).matchedCount)
        return badRequest('Order not found',404);
    } else if (resource === 'special') {
      if (method !== 'POST' && !isId(id)) return badRequest('Invalid special ID');
      const col = db.collection('specials');
      if (method === 'DELETE') {
        if (!(await col.deleteOne({ _id:new ObjectId(id) })).deletedCount) return badRequest('Special not found',404);
      } else {
        data = specialFields(b,method==='POST'); if (!Object.keys(data).length) return badRequest('No changes');
        if (data.starts_at && data.ends_at && new Date(String(data.starts_at)).getTime()>new Date(String(data.ends_at)).getTime()) return badRequest('End must follow start');
        if (method==='POST') await col.insertOne({ title:'',description:'',image_url:null,is_published:false,starts_at:null,ends_at:null,created_at:new Date(),...data });
        else if (!(await col.updateOne({ _id:new ObjectId(id) }, { $set:data })).matchedCount) return badRequest('Special not found',404);
      }
    } else if (resource === 'review' && method === 'PATCH') {
      if (!isId(id) || typeof b.is_approved !== 'boolean') return badRequest('Invalid review');
      if (!(await db.collection('reviews').updateOne({ _id:new ObjectId(id) }, { $set:{ is_approved:b.is_approved } })).matchedCount) return badRequest('Review not found',404);
    } else if (resource === 'catering' && method === 'PATCH') {
      if (!isId(id) || !inquiryStatuses.includes(String(b.status))) return badRequest('Invalid inquiry');
      if (!(await db.collection('catering_inquiries').updateOne({ _id:new ObjectId(id) }, { $set:{ status:b.status } })).matchedCount) return badRequest('Inquiry not found',404);
    } else return badRequest('Unsupported action');
    return NextResponse.json({ ok:true });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 11000) return badRequest('This item or category name already exists. Choose a different name.',409);
    if (e instanceof Error && (e.message.startsWith('Invalid ') || e.message.includes('required') || e.message.includes('cannot be') || e.message.includes('must be'))) return badRequest(e.message);
    return jsonError(e,'Administrator update failed');
  }
}
export async function POST(request: NextRequest) { return mutate(request,'POST'); }
export async function PATCH(request: NextRequest) { return mutate(request,'PATCH'); }
export async function DELETE(request: NextRequest) { return mutate(request,'DELETE'); }
