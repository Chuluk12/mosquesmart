import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../lib/api';
import './login.css';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => localStorage.getItem('rememberedUsername') || '');
  const [remember, setRemember] = useState(() => !!localStorage.getItem('rememberedUsername'));
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState(false);
  const [mosque, setMosque] = useState<{ name: string; city?: string; province?: string; timezone: string } | null>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    let mounted = true;
    api.get<typeof mosque>('/mosque').then(value => { if (mounted) setMosque(value); }).catch(() => {});
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      if (remember) localStorage.setItem('rememberedUsername', username);
      else localStorage.removeItem('rememberedUsername');
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login gagal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mosque-login">
      <main className="login-layout">
      <section className="login-welcome">
        <div className="login-gold-line"/>
        <h1>{mosque?.name || 'Mosque System'}</h1>
        <h2>Rumah Allah, Rumah Kita</h2>
        <p>Sistem manajemen mushola untuk memudahkan pengelolaan jadwal sholat, konten, dan audio secara terintegrasi.</p>
        <blockquote><span aria-hidden="true">“</span>“Dan dirikanlah sholat, sesungguhnya sholat mencegah dari perbuatan keji dan mungkar.”<cite>(QS. Al-'Ankabut: 45)</cite></blockquote>
      </section>
      <form className="mosque-login-card" onSubmit={onSubmit}>
        <div className="login-card-brand"><img src="/za-mark.svg" alt="Monogram ZA - Zainal Arifin"/><h2>Mosque System</h2><p>Panel Pengelolaan<br/>Mushola &amp; Masjid</p></div>
        {error && <div className="alert-error" role="alert">{error}</div>}
        <label htmlFor="username">Username</label>
        <div className="login-input"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg><input id="username" autoComplete="username" placeholder="Masukkan username" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
        <label htmlFor="password">Password</label>
        <div className="login-input"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg><input id="password" autoComplete="current-password" type={visible ? 'text' : 'password'} placeholder="Masukkan password" value={password} onChange={(e) => setPassword(e.target.value)} required /><button className="login-reveal" type="button" aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={visible} onClick={() => setVisible(v => !v)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}</svg></button></div>
        <div className="login-options"><label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/>Ingat username</label><button type="button" onClick={() => setHelp(v => !v)} aria-expanded={help}>Lupa password?</button></div>
        {help && <p className="login-help" role="status">Hubungi pengelola atau Super Admin mushola untuk bantuan mengatur ulang password akun.</p>}
        <button className="login-submit" type="submit" disabled={submitting}><span aria-hidden="true">→</span> {submitting ? 'Memproses...' : 'Masuk'}</button>
        <div className="login-divider"><span>atau</span></div>
        <a className="login-display-link" href={(import.meta as any).env?.VITE_DISPLAY_URL || `${window.location.protocol}//${window.location.hostname}:5174`} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="1"/><path d="M12 17v4m-5 0h10"/></svg>Buka Tampilan Display<span aria-hidden="true">›</span></a>
      </form>
      </main>
      <footer className="login-page-footer"><span>⌖ {[mosque?.city, mosque?.province].filter(Boolean).join(', ') || 'Lokasi mushola'}</span><span>{now.toLocaleDateString('id-ID', { timeZone: mosque?.timezone || 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><span>{now.toLocaleDateString('id-ID-u-ca-islamic', { timeZone: mosque?.timezone || 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })}</span><span>Mosque System</span></footer>
    </div>
  );
}
