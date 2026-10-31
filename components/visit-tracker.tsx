'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { recordActivity } from '@/lib/client-analytics';

/** Count a browsing session once per tab across public pages, never admin pages. */
export default function VisitTracker() {
  const path = usePathname();
  useEffect(() => {
    if (!path || path.startsWith('/admin') || path.startsWith('/api')) return;
    recordActivity('visit', undefined, true);
  }, [path]);
  return null;
}
