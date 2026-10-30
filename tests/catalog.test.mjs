import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const menu=JSON.parse(readFileSync(new URL('../scripts/seed-menu.json',import.meta.url),'utf8'));
test('31 unique, priced menu items with six categories',()=>{assert.equal(menu.length,31);assert.equal(new Set(menu.map(p=>p.id)).size,31);assert.equal(new Set(menu.map(p=>p.category)).size,6);for(const p of menu){assert.match(p.id,/^[a-z0-9-]+$/);assert.ok(p.name&&p.unit);assert.ok(p.price>0&&Number.isFinite(p.price))}});
test('advance-order items are marked in seed menu',()=>{assert.ok(menu.filter(p=>p.preOrder).length>=5);for(const id of ['idly-batter','dosa-batter','vada-batter'])assert.equal(menu.find(p=>p.id===id)?.preOrder,true)});
test('printable PDF has a valid cross-reference offset',()=>{const pdf=readFileSync(new URL('../public/aahvaanam-food-catalog.pdf',import.meta.url)).toString('latin1');assert.ok(pdf.startsWith('%PDF-1.4'));const m=pdf.match(/startxref\s+(\d+)\s+%%EOF/);assert.ok(m);assert.equal(pdf.slice(Number(m[1]),Number(m[1])+4),'xref');assert.ok(pdf.includes('/Type /Page'))});
test('original emblem optimized JPEG has valid boundaries',()=>{const b=readFileSync(new URL('../public/images/aahvaanam-logo.jpg',import.meta.url));assert.equal(b[0],0xff);assert.equal(b[1],0xd8);assert.equal(b[b.length-2],0xff);assert.equal(b[b.length-1],0xd9)});

test('approved Aahvaanam wordmark is a valid WebP asset',()=>{const b=readFileSync(new URL('../public/images/aahvaanam-correct-wordmark.webp',import.meta.url));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');assert.ok(b.length>3000)});
