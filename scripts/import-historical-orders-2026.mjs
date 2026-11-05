// One-time, repeatable historical order import. No notifications are sent.
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
const rows = [["001","Sakshi","216-288-2323","2026-11-01","16:00","delivery",[["Idly with peanut/coconut chutney",60,90],["Vada with 32oz sambar",40,80],["Half tray Bisibellabath",1,50],["Mirchi Bajji",40,70]],15,"completed","Cash at delivery requested"],["002","Unknown","440-804-6839","2026-10-31","18:00","delivery",[["3lb Idly Batter",1,10],["Bakshalu",15,30],["Vada",30,60]],15,"completed","Split fulfillment: batter pickup 8:00 AM; remaining items delivery 6:00 PM. Original fulfillment was Pickup and Delivery."],["003","Jyotsna","","2026-10-29","12:00","pickup",[["Jowar Rotis",10,20],["Regular Rotis",10,20]],0,"completed","Time not specified; noon placeholder for historical import. Prices based on standard roti pricing."],["004","Unknown","602-884-4058","2026-10-28","18:00","pickup",[["Jowar Rotis",5,10],["Mysore Bonda plates",2,20],["Tomato Chutney",1,10]],0,"completed","Evening time unspecified; 6 PM placeholder. Customer requested softer Jowar rotis due to previous dryness."],["005","Unknown","469-594-1669","2026-10-27","17:00","pickup",[["Bakshalu",15,30]],0,"completed",""],["006","Unknown","216-387-6360","2026-10-29","12:00","pickup",[["16oz Chicken Pickle",1,16],["16oz Regular Rasam",1,8]],0,"completed","Pickup window 11:30 AM–12:30 PM; noon is midpoint."],["007","Unknown","412-620-3221","2026-10-28","13:00","pickup",[["Bobbatlu",15,30],["Jowar Rotis",5,10],["16oz Chicken Pickle",1,16]],0,"completed","Customer requested notification if ready early."],["008","Unknown","330-391-0735","2026-10-31","15:00","delivery",[["16oz Eggplant Kurma",1,12],["Jowar Rotis",5,10],["Ragi Rotis",5,10],["Mysore Bonda plate",1,10],["3lb Millet Dosa Batter",1,10]],15,"completed","Afternoon time unspecified; 3 PM placeholder."],["009","Unknown","440-657-7454","2026-11-01","16:30","pickup",[["Mutton Biryani plate",1,15],["Mysore Bonda plate",1,10],["Bobbatlu",5,10]],0,"completed",""],["010","Unknown","","2026-10-30","12:00","pickup",[["Mirchi Bajji plate",1,10],["Punugulu plate",1,10],["16oz Chicken Curry",1,12],["16oz Chicken Fry",1,12]],0,"completed","Time not specified; noon placeholder for historical import."],["011","Raj","","2026-11-01","12:00","pickup",[["Mutton Dum Biryani (quantity unconfirmed)",1,45]],0,"completed","Approximate total $45; quantity unconfirmed; imported as one unverified line item solely to preserve reported total. Time not specified; noon placeholder."],["012","Unknown","440-532-9408","2026-11-04","15:00","pickup",[["Ragi Rotis",5,10],["Purnalu",15,30]],0,"pending","Afternoon time unspecified; 3 PM placeholder. Purnalu priced at $2 each."]];
const dryRun = !process.argv.includes('--apply');
if (!dryRun && !process.env.MONGODB_URI) throw new Error('MONGODB_URI required for --apply');
const client = dryRun ? null : new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
let inserted = 0, skipped = 0;
try {
  if (client) await client.connect();
  const db = client?.db(process.env.MONGODB_DB_NAME || 'aahvaanam_kitchen');
  for (const [legacyId,name,phone,date,time,fulfillment,items,fee,status,notes] of rows) {
    const importKey = 'aahvaanam-historical-2026-' + legacyId;
    const orderItems = items.map(([itemName,quantity,lineDollars]) => {
      const line_total_cents = Math.round(lineDollars * 100);
      return { product_name_snapshot: itemName, quantity,
        unit_price_cents: Math.round(line_total_cents / quantity), line_total_cents };
    });
    const subtotal = orderItems.reduce((sum,item) => sum + item.line_total_cents, 0);
    const feeCents = Math.round(fee * 100);
    if (dryRun) { console.log('DRY RUN', legacyId, date, name, '$' + ((subtotal+feeCents)/100).toFixed(2)); continue; }
    const orders = db.collection('orders');
    if (await orders.findOne({ client_request_id: importKey })) { skipped++; continue; }
    // Counter is shared with live orders. Historical IDs are deliberately not reused.
    const counter = await db.collection('counters').findOneAndUpdate(
      { _id: 'order' }, { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' });
    if (!counter) throw new Error('Unable to allocate order number');
    const doc = {
      client_request_id: importKey, order_number: counter.value,
      customer_name: name, customer_phone: phone, fulfillment,
      requested_date: date, requested_time: time, delivery_address: null,
      customer_notes: notes, status, payment_status: 'unpaid',
      status_comment: 'Historical import. Payment was not confirmed in supplied records.',
      subtotal_cents: subtotal, delivery_fee_cents: feeCents,
      total_cents: subtotal + feeCents, order_items: orderItems,
      historical_import: true, historical_reference: legacyId,
      historical_payment_unverified: true,
      created_at: new Date(date + 'T12:00:00-04:00'),
      updated_at: new Date(),
    };
    await orders.insertOne(doc);
    inserted++;
  }
  console.log(dryRun ? 'Dry run complete. Use --apply with MONGODB_URI to insert.' :
    'Imported ' + inserted + ' historical orders; skipped ' + skipped + ' existing.');
} finally { if (client) await client.close(); }
