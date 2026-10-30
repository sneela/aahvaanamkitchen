import type { Metadata } from 'next';
import OrderTracker from '@/components/order-tracker';

export const metadata: Metadata = {
  title: 'Track Your Order | Aahvaanam Kitchen',
  description: 'Look up your Aahvaanam Kitchen order using your order number and the phone number from checkout.',
  robots: { index: false, follow: false },
};

export default function TrackOrderPage() {
  return <main className="track-page">
    <header className="track-header"><a href="/"><img src="/images/aahvaanam-correct-wordmark.webp" alt="Aahvaanam Kitchen" /></a><a href="/">Back to menu</a></header>
    <section className="track-container"><OrderTracker /></section>
  </main>;
}
