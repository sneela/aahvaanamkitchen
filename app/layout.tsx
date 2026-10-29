import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aahvaanam Kitchen | Every Bite Feels Like Home',
  description: 'Homemade Indian food, traditional snacks, curries, rotis, pickles and sweets. Takeout and catering serving Greater Cleveland, Ohio.',
  metadataBase: new URL('https://aahvaanamkitchen.com'),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
