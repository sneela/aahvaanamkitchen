import { menuItems, type MenuItem } from '@/lib/menu';
import { mongoConfigured, mongoDb } from '@/lib/mongodb/client';
import type { ProductDoc } from '@/lib/mongodb/models';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Current Menu | Aahvaanam Kitchen',
  description: 'Current Aahvaanam Kitchen menu, pricing and pre-order information.',
};

type CatalogResult = { items: MenuItem[]; source: 'live' | 'sample' | 'unavailable' };

async function getCatalog(): Promise<CatalogResult> {
  if (!mongoConfigured()) return { items: menuItems, source: 'sample' };
  try {
    const db = await mongoDb();
    const [products, categories] = await Promise.all([
      db.collection<ProductDoc>('products').find({ is_available: true }).sort({ sort_order: 1, name: 1 }).toArray(),
      db.collection<{ id: string; name: string; is_active: boolean }>('categories').find({ is_active: true }).toArray(),
    ]);
    const names = new Map(categories.map(category => [category.id, category.name]));
    return {
      source: 'live',
      items: products.filter(p => !p.category_id || names.has(p.category_id)).map(p => ({
        id: p.slug,
        name: p.name,
        category: names.get(p.category_id || '') || 'Other',
        price: p.price_cents / 100,
        unit: p.unit_label,
        description: p.description,
        image: p.image_url || '/images/aahvaanam-logo.jpg',
        preOrder: p.requires_preorder,
        preorderNoticeHours: p.preorder_notice_hours,
        vegetarian: p.is_vegetarian,
      })),
    };
  } catch (error) {
    console.error('Printable catalog unavailable', error);
    // Never present old sample prices as current when a configured database is unavailable.
    return { items: [], source: 'unavailable' };
  }
}

export default async function Catalog() {
  const { items, source } = await getCatalog();
  const categories = [...new Set(items.map(item => item.category))];
  return <main style={{ maxWidth: 850, margin: 'auto', padding: '30px 20px', fontFamily: 'Arial,sans-serif', color: '#50352d' }}>
    <header style={{ textAlign: 'center' }}>
      <a href="/"><img src="/images/aahvaanam-logo.jpg" alt="Aahvaanam Kitchen logo" width="180" /></a>
      <h1>Aahvaanam Kitchen</h1>
      <p>Every bite feels like home · Greater Cleveland, Ohio</p>
      <p>WhatsApp +1 (216) 236-4062 · Takeout & catering</p>
      <p><a href="/">Back to storefront</a> · <a href="/aahvaanam-food-catalog.pdf" download>Original menu flyer (reference)</a></p>
    </header>
    <h2>Menu and prices</h2>
    {source === 'live' && <p role="status">Current available items and prices from our kitchen menu. All requests require manual confirmation.</p>}
    {source === 'sample' && <p role="status" style={{ padding: 12, background: '#fff2d8' }}>Sample menu only. Live pricing and availability are not connected. Please confirm on WhatsApp before ordering.</p>}
    {source === 'unavailable' && <p role="alert" style={{ padding: 12, background: '#fff2d8' }}>The current menu is temporarily unavailable. Please contact us on WhatsApp for accurate prices and availability.</p>}
    {source === 'live' && items.length === 0 && <p>There are no available menu items at the moment. Please contact us for today's options.</p>}
    {categories.map(category => <section key={category}>
      <h2 style={{ color: '#762a3a', borderBottom: '1px solid #b9894e', paddingBottom: 6 }}>{category}</h2>
      {items.filter(item => item.category === category).map(item => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid #eee' }}>
        <span>{item.name} {item.preOrder ? '(Pre-order)' : ''}<small style={{ color: '#806e62' }}> · {item.unit}</small></span>
        <strong style={{ whiteSpace: 'nowrap' }}>${item.price.toFixed(2)}</strong>
      </div>)}
    </section>)}
    <p style={{ marginTop: 35, fontSize: 12 }}>Prices and availability are subject to confirmation. Delivery minimum and fees may apply. No online payments. The downloadable original flyer is a reference and may not reflect current menu changes.</p>
  </main>;
}
