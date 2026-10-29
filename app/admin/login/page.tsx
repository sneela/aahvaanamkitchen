'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function AdminLogin() {
  const router = useRouter();
  const [email,setEmail] = useState(''), [password,setPassword] = useState('');
  const [error,setError] = useState(''), [loading,setLoading] = useState(false);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Unable to sign in'); }
      router.replace('/admin'); router.refresh();
    } catch(e) { setError(e instanceof Error ? e.message : 'Unable to sign in'); }
    finally { setLoading(false); }
  }
  return <main className="admin-login"><div className="login-card">
    <Image src="/images/aahvaanam-logo.png" alt="Aahvaanam" width={96} height={96}/>
    <h1>Kitchen administration</h1><p>Sign in with your authorized kitchen administrator account.</p>
    <form onSubmit={login}><label>Email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <button type="submit" disabled={loading}>{loading?'Signing in…':'Sign in'}</button></form>
    <a href="/">← Back to website</a></div></main>;
}
