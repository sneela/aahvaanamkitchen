import 'server-only';
import webpush from 'web-push';
import { mongoDb } from '@/lib/mongodb/client';
export async function notifyAdminDevices(orderNumber: number) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !contact) return;
  webpush.setVapidDetails(contact, publicKey, privateKey);
  const db = await mongoDb();
  const subscriptions = await db.collection('push_subscriptions').find().limit(25).toArray();
  await Promise.allSettled(subscriptions.map(async sub => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify({ body: 'New order #' + orderNumber + ' received. Open the admin dashboard.', tag: 'order-' + orderNumber }),
        { TTL: 3600 });
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await db.collection('push_subscriptions').deleteOne({ _id: sub._id });
      } else console.error('Web push delivery failed', error?.statusCode || 'unknown');
    }
  }));
}
