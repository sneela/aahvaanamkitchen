import { redirect } from 'next/navigation';
import { authConfigured, requireAdmin } from '@/lib/auth/session';
import { mongoConfigured } from '@/lib/mongodb/client';
import AdminDashboard from './dashboard';
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  if (!mongoConfigured() || !authConfigured()) return <main className="admin-shell"><h1>Administrator setup required</h1><p>Configure MongoDB and administrator environment variables on the hosting service before signing in.</p><a href="/">Return to website</a></main>;
  try { await requireAdmin(); } catch { redirect('/admin/login'); }
  return <AdminDashboard />;
}
