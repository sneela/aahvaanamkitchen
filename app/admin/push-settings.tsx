'use client';
import { useEffect, useState } from 'react';
function decodeKey(base64: string) {
  const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
export default function PushSettings() {
  const [configured, setConfigured] = useState(false);
  const [key, setKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    fetch('/api/admin/push', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setConfigured(Boolean(d.configured)); setKey(d.publicKey || '');
    }).catch(() => setMessage('Unable to load push settings.'));
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration('/order-push-sw.js').then(async reg => {
      if (reg) setEnabled(Boolean(await reg.pushManager.getSubscription()));
    });
  }, []);
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  async function enable() {
    setMessage('');
    try {
      if (Notification.permission === 'denied') throw Error('Notifications are blocked in device settings.');
      const registration = await navigator.serviceWorker.register('/order-push-sw.js', { scope: '/' });
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw Error('Notification permission was not granted.');
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) });
      const response = await fetch('/api/admin/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) });
      if (!response.ok) throw Error('Unable to register this device.');
      setEnabled(true); setMessage('Notifications enabled on this device.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to enable notifications.'); }
  }
  async function disable() {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/order-push-sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch('/api/admin/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        if (!response.ok) throw Error('Unable to remove subscription.');
        await subscription.unsubscribe();
      }
      setEnabled(false); setMessage('Notifications disabled on this device.');
    } catch { setMessage('Unable to disable notifications.'); }
  }
  return <section className="admin-card"><h3>New order notifications</h3><p>Enable separately on each owner's phone. On iPhone, first add the site to your Home Screen and open it there. On Android, use Chrome. Notifications require permission and can be delayed by battery settings.</p>
    {!supported ? <p>Push notifications are not supported in this browser.</p> : !configured ? <p>Configure VAPID keys on the server before enabling notifications.</p> : <button type="button" className="secondary" onClick={() => void (enabled ? disable() : enable())}>{enabled ? 'Disable notifications on this device' : 'Enable notifications on this device'}</button>}
    {message && <p role="status">{message}</p>}
  </section>;
}
