'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

export type CatalogRow = { id: string; name?: string; slug?: string; description?: string; category_id?: string | null; price_cents?: number; unit_label?: string; image_url?: string | null; is_available?: boolean; requires_preorder?: boolean; preorder_notice_hours?: number; is_vegetarian?: boolean | null; sort_order?: number; };
export type CategoryRow = { id: string; name: string; is_active: boolean; sort_order: number };
type Save = (method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) => Promise<boolean>;

const slug = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/g, '');
const dollars = (cents: number) => (Number(cents || 0) / 100).toFixed(2);
const emptyProduct = (): CatalogRow => ({ id: '', name: '', description: '', category_id: '', price_cents: 0, unit_label: 'per order', image_url: null, is_available: true, requires_preorder: false, preorder_notice_hours: 24, is_vegetarian: null, sort_order: 100 });

/** Resize locally before sending images to Atlas; never store base64 in product records. */
async function prepareImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.');
  if (file.size > 15_000_000) throw new Error('Original image must be smaller than 15 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable on this browser.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(v => v ? resolve(v) : reject(new Error('Unable to prepare image')), 'image/jpeg', 0.75));
    if (blob.size > 1_500_000) throw new Error('Image is still too large. Please choose a smaller image.');
    return new File([blob], 'product-photo.jpg', { type: 'image/jpeg' });
  } finally { bitmap.close(); }
}

function ImagePicker({ value, onChange, disabled }: { value: string | null | undefined; onChange: (value: string | null) => void; disabled?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true); setError('');
    try {
      const compressed = await prepareImage(file);
      const form = new FormData();
      form.append('image', compressed);
      const response = await fetch('/api/admin/images', { method: 'POST', body: form, cache: 'no-store' });
      const result: { image_url?: string; error?: string } = await response.json();
      if (!response.ok || !result.image_url) throw new Error(result.error || 'Image upload failed.');
      onChange(result.image_url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Image upload failed.'); }
    finally { setUploading(false); }
  };
  return <div className="admin-photo-editor">
    {value ? <img className="admin-photo-preview" src={value} alt="Menu product preview" /> : <div className="admin-photo-placeholder">No image</div>}
    <label className="admin-photo-choose">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || uploading} onChange={e => void choose(e)} /></label>
    {value && <button type="button" className="admin-action" disabled={disabled || uploading} onClick={() => onChange(null)}>Remove image</button>}
    <input aria-label="Or paste image URL" placeholder="Or paste an HTTPS image URL" maxLength={500} value={value || ''} disabled={disabled || uploading} onChange={e => onChange(e.target.value || null)} />
    {uploading && <small role="status">Resizing and uploading photo…</small>}
    {error && <small className="admin-inline-error" role="alert">{error}</small>}
  </div>;
}

function PriceInput({ cents, onChange, disabled, form }: { cents: number; onChange: (next: number) => void; disabled?: boolean; form?: string }) {
  const [typed, setTyped] = useState(dollars(cents));
  useEffect(() => { setTyped(dollars(cents)); }, [cents]);
  return <input form={form} aria-label="Price in dollars" type="number" min="0" max="10000" step="0.01" required disabled={disabled} value={typed}
    onChange={event => { const next = event.target.value; setTyped(next); if (next !== '' && Number.isFinite(Number(next))) onChange(Math.round(Number(next) * 100)); }}
    onBlur={() => setTyped(dollars(cents))} />;
}

function ProductFields({ v, setV, categories, prefix, busy }: { v: CatalogRow; setV: (data: CatalogRow) => void; categories: CategoryRow[]; prefix: string; busy: boolean }) {
  const field = <K extends keyof CatalogRow>(key: K, value: CatalogRow[K]) => setV({ ...v, [key]: value });
  return <>
    <label>Item name<input required maxLength={120} value={v.name || ''} disabled={busy} onChange={e => field('name', e.target.value)} /></label>
    <label>Category<select value={v.category_id || ''} disabled={busy} onChange={e => field('category_id', e.target.value || null)}><option value="">Other / Unassigned</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (inactive)'}</option>)}</select></label>
    <label>Price ($)<PriceInput cents={v.price_cents || 0} disabled={busy} onChange={next => field('price_cents', next)} /></label>
    <label>Unit / quantity<input required maxLength={100} value={v.unit_label || ''} disabled={busy} onChange={e => field('unit_label', e.target.value)} /></label>
    <label>Pre-order notice (hours)<input type="number" min="0" max="720" value={v.preorder_notice_hours ?? 24} disabled={busy} onChange={e => field('preorder_notice_hours', Number(e.target.value))} /></label>
    <label>Display order<input type="number" min="-100000" max="100000" value={v.sort_order ?? 100} disabled={busy} onChange={e => field('sort_order', Number(e.target.value))} /></label>
    <label>Dietary<select value={v.is_vegetarian === null || v.is_vegetarian === undefined ? 'unknown' : v.is_vegetarian ? 'vegetarian' : 'nonvegetarian'} disabled={busy} onChange={e => field('is_vegetarian', e.target.value === 'unknown' ? null : e.target.value === 'vegetarian')}><option value="unknown">Not specified</option><option value="vegetarian">Vegetarian</option><option value="nonvegetarian">Non-vegetarian</option></select></label>
    <label className="wide">Description<textarea maxLength={1000} value={v.description || ''} disabled={busy} onChange={e => field('description', e.target.value)} /></label>
    <div className="wide"><span className="admin-field-label">Product photo</span><ImagePicker value={v.image_url} disabled={busy} onChange={url => field('image_url', url)} /></div>
    <label className="admin-check"><input type="checkbox" checked={Boolean(v.is_available)} disabled={busy} onChange={e => field('is_available', e.target.checked)} /> Available</label>
    <label className="admin-check"><input type="checkbox" checked={Boolean(v.requires_preorder)} disabled={busy} onChange={e => field('requires_preorder', e.target.checked)} /> Requires pre-order</label>
    <p className="wide admin-hint">Slug (internal ID): <code>{v.id ? v.slug : (slug(v.name || '') || 'generated-from-name')}</code>. Automatically created from the name; it is not required when adding an item. {prefix === 'new' ? '' : 'It remains unchanged when you rename the item.'}</p>
  </>;
}

function productPayload(v: CatalogRow): Record<string, unknown> {
  return {
    resource: 'product', name: (v.name || '').trim(), description: v.description || '',
    category_id: v.category_id || null, price_cents: v.price_cents ?? 0,
    unit_label: v.unit_label || 'per order', image_url: v.image_url || null,
    is_available: Boolean(v.is_available), requires_preorder: Boolean(v.requires_preorder),
    preorder_notice_hours: v.preorder_notice_hours ?? 24,
    is_vegetarian: v.is_vegetarian ?? null, sort_order: v.sort_order ?? 100,
  };
}

function ProductTableRow({ product, categories, busy, save }: { product: CatalogRow; categories: CategoryRow[]; busy: boolean; save: Save }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CatalogRow>({ ...product });
  useEffect(() => { if (!editing) setDraft({ ...product }); }, [product, editing]);
  const edit = () => { setDraft({ ...product }); setEditing(true); };
  const cancel = () => { setDraft({ ...product }); setEditing(false); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await save('PATCH', { ...productPayload(draft), id: product.id })) setEditing(false);
  };
  const remove = async () => {
    if (!window.confirm('Permanently delete "' + product.name + '"? Existing order history will remain.')) return;
    await save('DELETE', { resource: 'product', id: product.id });
  };
  const category = categories.find(c => c.id === product.category_id);
  return <tr className={editing ? 'admin-editing-row' : ''}>
    <td>{(editing ? draft.image_url : product.image_url) ? <img className="admin-table-thumbnail" src={(editing ? draft.image_url : product.image_url) || undefined} alt={product.name || 'Product'} /> : <span className="admin-no-photo">No photo</span>}{editing && <ImagePicker value={draft.image_url} onChange={image_url => setDraft({ ...draft, image_url })} disabled={busy} />}</td>
    <td>{editing ? <input form={'edit-' + product.id} required maxLength={120} aria-label="Item name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} disabled={busy} /> : <strong>{product.name}</strong>}</td>
    <td><small title={product.id}>{product.slug}</small></td>
    <td>{editing ? <select form={'edit-' + product.id} aria-label="Category" disabled={busy} value={draft.category_id || ''} onChange={e => setDraft({ ...draft, category_id: e.target.value || null })}><option value="">Other</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : (category?.name || 'Other')}</td>
    <td>{editing ? <PriceInput form={'edit-' + product.id} cents={draft.price_cents || 0} onChange={next => setDraft({ ...draft, price_cents: next })} disabled={busy} /> : '$' + dollars(product.price_cents || 0)}</td>
    <td>{editing ? <input form={'edit-' + product.id} maxLength={100} aria-label="Unit" value={draft.unit_label || ''} onChange={e => setDraft({ ...draft, unit_label: e.target.value })} disabled={busy} /> : product.unit_label}</td>
    <td>{editing ? <textarea form={'edit-' + product.id} maxLength={1000} aria-label="Description" value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} disabled={busy} /> : <span title={product.description || ''}>{product.description || '—'}</span>}</td>
    <td>{editing ? <input form={'edit-' + product.id} aria-label="Available" type="checkbox" checked={Boolean(draft.is_available)} onChange={e => setDraft({ ...draft, is_available: e.target.checked })} disabled={busy} /> : product.is_available ? 'Yes' : 'No'}</td>
    <td>{editing ? <input form={'edit-' + product.id} aria-label="Requires pre-order" type="checkbox" checked={Boolean(draft.requires_preorder)} onChange={e => setDraft({ ...draft, requires_preorder: e.target.checked })} disabled={busy} /> : product.requires_preorder ? 'Yes' : 'No'}</td>
    <td>{editing ? <input form={'edit-' + product.id} type="number" min="0" max="720" aria-label="Notice hours" value={draft.preorder_notice_hours ?? 0} onChange={e => setDraft({ ...draft, preorder_notice_hours: Number(e.target.value) })} disabled={busy} /> : String(product.preorder_notice_hours ?? 0)}</td>
    <td>{editing ? <select form={'edit-' + product.id} aria-label="Dietary" disabled={busy} value={draft.is_vegetarian === null || draft.is_vegetarian === undefined ? 'unknown' : draft.is_vegetarian ? 'vegetarian' : 'nonvegetarian'} onChange={e => setDraft({ ...draft, is_vegetarian: e.target.value === 'unknown' ? null : e.target.value === 'vegetarian' })}><option value="unknown">Unspecified</option><option value="vegetarian">Veg</option><option value="nonvegetarian">Non-veg</option></select> : product.is_vegetarian === null || product.is_vegetarian === undefined ? '—' : product.is_vegetarian ? 'Veg' : 'Non-veg'}</td>
    <td>{editing ? <input form={'edit-' + product.id} type="number" min="-100000" max="100000" aria-label="Sort order" value={draft.sort_order ?? 100} onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) })} disabled={busy} /> : product.sort_order}</td>
    <td>
      <form id={'edit-' + product.id} onSubmit={e => void submit(e)} className="admin-table-actions">
        {editing ? <><button className="primary" disabled={busy} type="submit">Save</button><button className="admin-action" disabled={busy} type="button" onClick={cancel}>Cancel</button></> : <button className="admin-action" disabled={busy} type="button" onClick={edit}>Edit</button>}
        <button type="button" className="danger" disabled={busy} onClick={() => void remove()}>Delete</button>
      </form>
    </td>
  </tr>;
}

export function CatalogManager({ products, categories, busy, save }: { products: CatalogRow[]; categories: CategoryRow[]; busy: boolean; save: Save }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState<CatalogRow>(emptyProduct);
  const [filter, setFilter] = useState('');
  const matching = products.filter(p => (p.name + ' ' + p.slug + ' ' + p.description).toLowerCase().includes(filter.toLowerCase()));
  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (await save('POST', productPayload(newItem))) { setNewItem(emptyProduct()); setShowAdd(false); }
  };
  return <section className="admin-catalog">
    <div className="admin-section-heading"><div><h2>Menu items</h2><p>All items and settings are listed below. Scroll horizontally to see every column.</p></div><button className="primary" type="button" onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Close add form' : '+ Add menu item'}</button></div>
    {showAdd && <article className="admin-card admin-new-product"><h3>Add a new menu item</h3><form onSubmit={e => void create(e)}><ProductFields v={newItem} setV={setNewItem} categories={categories} prefix="new" busy={busy} /><div className="wide"><button type="submit" className="primary" disabled={busy}>Save new item</button><button type="button" className="admin-action" onClick={() => { setShowAdd(false); setNewItem(emptyProduct()); }} disabled={busy}>Cancel</button></div></form></article>}
    <div className="admin-table-tools"><label>Search menu<input type="search" placeholder="Search by name, description, or slug" value={filter} onChange={e => setFilter(e.target.value)} /></label><span>{matching.length} of {products.length} items</span></div>
    <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr>{['Photo','Item name','Slug','Category','Price','Unit','Description','Available','Pre-order','Notice hrs','Dietary','Sort','Actions'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{matching.map(p => <ProductTableRow key={p.id} product={p} categories={categories} busy={busy} save={save} />)}{!matching.length && <tr><td colSpan={13}>No matching menu items.</td></tr>}</tbody></table></div>
  </section>;
}

function CategoryTableRow({ item, count, busy, save }: { item: CategoryRow; count: number; busy: boolean; save: Save }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...item });
  useEffect(() => { if (!editing) setDraft({ ...item }); }, [item, editing]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await save('PATCH', { resource: 'category', category_id: item.id, name: draft.name.trim(), sort_order: draft.sort_order, is_active: draft.is_active })) setEditing(false);
  };
  const remove = async () => {
    if (!window.confirm('Delete "' + item.name + '"? Categories containing products cannot be deleted.')) return;
    await save('DELETE', { resource: 'category', category_id: item.id });
  };
  return <tr><td>{editing ? <input form={'cat-' + item.id} required minLength={2} maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} disabled={busy} /> : <strong>{item.name}</strong>}</td>
    <td><code>{item.id}</code></td><td>{count}</td>
    <td>{editing ? <input form={'cat-' + item.id} aria-label="Display order" type="number" min="-100000" max="100000" value={draft.sort_order} onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) })} disabled={busy} /> : item.sort_order}</td>
    <td>{editing ? <input form={'cat-' + item.id} type="checkbox" aria-label="Active" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} disabled={busy} /> : item.is_active ? 'Yes' : 'No'}</td>
    <td><form id={'cat-' + item.id} onSubmit={e => void submit(e)} className="admin-table-actions">{editing ? <><button className="primary" type="submit" disabled={busy}>Save</button><button className="admin-action" type="button" disabled={busy} onClick={() => { setDraft({ ...item }); setEditing(false); }}>Cancel</button></> : <button className="admin-action" type="button" disabled={busy} onClick={() => setEditing(true)}>Edit</button>}<button className="danger" type="button" disabled={busy || count > 0} title={count > 0 ? 'Move or remove products first' : 'Delete category'} onClick={() => void remove()}>Delete</button></form></td>
  </tr>;
}
export function CategoryManager({ categories, products, busy, save }: { categories: CategoryRow[]; products: CatalogRow[]; busy: boolean; save: Save }) {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(100);
  const [active, setActive] = useState(true);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (await save('POST', { resource: 'category', name: name.trim(), is_active: active, sort_order: sortOrder })) {
      setName(''); setSortOrder(100); setActive(true);
    }
  };
  return <section className="admin-catalog">
    <div className="admin-section-heading"><div><h2>Menu categories</h2><p>Add categories directly to MongoDB. Categories can be renamed or hidden. Categories containing products cannot be deleted.</p></div></div>
    <article className="admin-card admin-new-category"><h3>Add category</h3><form onSubmit={e => void create(e)}><label>Category name<input required minLength={2} maxLength={80} placeholder="e.g. Homemade Pickles" value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label><label>Display order<input type="number" min="-100000" max="100000" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} disabled={busy} /></label><label className="admin-check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={busy} /> Active</label><div className="wide"><p className="admin-hint">Slug is generated automatically: <code>{slug(name) || 'from-category-name'}</code></p><button className="primary" type="submit" disabled={busy}>Add category</button></div></form></article>
    <div className="admin-table-scroll"><table className="admin-data-table admin-category-table"><thead><tr>{['Category name','Slug','Products','Sort','Active','Actions'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{categories.map(c => <CategoryTableRow key={c.id} item={c} count={products.filter(p => p.category_id === c.id).length} busy={busy} save={save} />)}{!categories.length && <tr><td colSpan={6}>No categories yet. Create your first category above.</td></tr>}</tbody></table></div>
  </section>;
}
