import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { getRealtimeSocket } from '../lib/socket';
import './sidebar.css';

const ICONS: Record<string, string> = {
  '/change-password': 'M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0v3m-4 4v3',
  '/': 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  '/mosque': 'M3 21h18M5 21V10m14 11V10M8 21V11h8v10M8 11c0-4 4-5 4-7 0 2 4 3 4 7M3 10h4m10 0h4M5 5v2m14-2v2',
  '/prayer-settings': 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  '/agenda': 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 11h18M7 15h3m4 0h3m-10 3h3',
  '/content': 'M6 3h9l4 4v14H5V3h1m9 0v5h4M9 12h6m-6 4h6',
  '/audio': 'M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-3-3h3m11 1a3 3 0 1 1-3-3h3',
  '/audio-schedule': 'M12 3a9 9 0 1 0 9 9M12 7v5l-3 2m7-11v7m0-5 5-1v5m-5 1a2 2 0 1 1-2-2h2m5 1a2 2 0 1 1-2-2h2',
  '/players': 'M3 8h18v12H3ZM8 4h8M7 12h1m3 0h6M7 16h1m3 0h6',
  '/history': 'M3 11a9 9 0 1 1 2 7M3 5v6h6m3-4v5l3 2',
  display: 'M3 4h18v13H3ZM8 21h8m-4-4v4',
  logout: 'M10 3H4v18h6m4-14 5 5-5 5m-6-5h11',
};
function SidebarIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name] || ICONS.display} /></svg>;
}

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/mosque', label: 'Identitas Masjid' },
  { to: '/prayer-settings', label: 'Jadwal Sholat' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/content', label: 'Konten' },
  { to: '/audio', label: 'Audio Library' },
  { to: '/audio-schedule', label: 'Jadwal Audio' },
  { to: '/players', label: 'Player & Play Now' },
  { to: '/history', label: 'History' },
  { to: '/display-themes', label: 'Tema Display' },
  { to: '/change-password', label: 'Ganti Password' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const [mosqueName, setMosqueName] = useState('');
  useEffect(() => {
    let mounted = true;
    const refresh = () => api.get<{ name: string }>('/mosque').then(m => { if (mounted) setMosqueName(m.name); }).catch(() => {});
    void refresh();
    const socket = getRealtimeSocket();
    socket.on('mosque:updated', refresh);
    return () => { mounted = false; socket.off('mosque:updated', refresh); };
  }, []);
  const displayUrl = (import.meta as any).env?.VITE_DISPLAY_URL || `${window.location.protocol}//${window.location.hostname}:5174`;
  return (
    <div className="app">
      <aside className="reference-sidebar">
        <div className="sidebar-brand"><img src="/za-mark.svg" alt="Monogram ZA - Zainal Arifin"/><div><strong>Mosque System</strong><small>Panel pengelolaan mushola</small></div></div>
        <div className="nav-label">MENU UTAMA</div>
        <nav aria-label="Menu admin">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'nav-active' : '')}>
              <SidebarIcon name={item.to}/>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-mosque"><div className="sidebar-skyline" aria-hidden="true"><img src="/mosque-logo.svg" alt=""/><img src="/mosque-logo.svg" alt=""/><img src="/mosque-logo.svg" alt=""/></div><strong>{mosqueName || 'Mushola'}</strong><small>Rumah Allah, Rumah Kita</small></div>
          <a className="sidebar-display" href={displayUrl} target="_blank" rel="noopener noreferrer"><SidebarIcon name="display"/>Lihat Tampilan Display<span aria-hidden="true">↗</span></a>
          <div className="sidebar-session"><span><b>{user?.name}</b><small>{user?.role?.replaceAll('_', ' ')}</small></span><button type="button" onClick={logout} title="Keluar" aria-label="Keluar dari akun"><SidebarIcon name="logout"/></button></div>
        </div>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

