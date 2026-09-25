import {Select} from '../components/Select';
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import './mosque-settings.css';

interface Mosque {
  id: string; name: string; address?: string; city?: string; province?: string;
  latitude?: number; longitude?: number; timezone: string; runningText?: string; logo?: string;
}

const CITIES = [
  { city: 'Bekasi', province: 'Jawa Barat', latitude: -6.2394, longitude: 106.9927, timezone: 'Asia/Jakarta' },
  { city: 'Balikpapan', province: 'Kalimantan Timur', latitude: -1.26753, longitude: 116.82887, timezone: 'Asia/Makassar' },
];

const normalize = (m: Mosque): Mosque => ({ ...m,
  latitude: m.latitude == null ? undefined : Number(m.latitude),
  longitude: m.longitude == null ? undefined : Number(m.longitude),
});

export function MosqueSettingsPage() {
  const [form, setForm] = useState<Mosque | null>(null);
  const [savedForm, setSavedForm] = useState<Mosque | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { api.get<Mosque>('/mosque').then((m) => { setForm(normalize(m)); setSavedForm(normalize(m)); }).catch(err => setMessage(`Gagal: ${err.message}`)); }, []);

  if (!form) return <p role="status">{message || 'Memuat...'}</p>;

  const set = <K extends keyof Mosque>(key: K, value: Mosque[K]) => setForm({ ...form, [key]: value });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const saved = await api.put<Mosque>('/mosque', form);
      setForm(normalize(saved));
      setSavedForm(normalize(saved));
      try {
        await api.get('/prayers/today');
        setMessage('Tersimpan. Jadwal hari ini sudah diperbarui sesuai lokasi masjid.');
      } catch {
        setMessage('Tersimpan, tetapi jadwal belum tersedia. Periksa koneksi internet lalu simpan kembali.');
      }
    } catch (err) {
      setMessage(`Gagal: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mosque-settings">
      <header><div><small>✧ IDENTITAS MASJID</small><h1>Identitas Masjid</h1><p>Kelola informasi dasar masjid yang akan ditampilkan pada layar dan sistem.</p></div></header>
      {message && <div className={message.startsWith('Gagal') ? 'alert-error' : 'alert-success'}>{message}</div>}
      <div className="mosque-settings-grid">
      <form id="mosque-identity-form" className="form-panel" onSubmit={onSubmit}>
        <h2 className="form-section-title">Informasi Masjid</h2>
        <p className="hint">Data ini akan ditampilkan pada layar informasi dan digunakan di seluruh sistem.</p>
        <label>Nama Masjid</label>
        <input value={form.name || ''} onChange={(e) => set('name', e.target.value)} required />

        <label>Alamat</label>
        <input value={form.address || ''} onChange={(e) => set('address', e.target.value)} />

        <label htmlFor="city-preset">Pilih lokasi jadwal salat</label>
        <Select id="city-preset" value={CITIES.find((c) => c.city === form.city && c.latitude === form.latitude && c.longitude === form.longitude && c.timezone === form.timezone)?.city || ''}
          onChange={(e) => { const city = CITIES.find((c) => c.city === e.target.value); if (city) setForm({ ...form, ...city }); }}>
          <option value="">Lokasi manual</option>
          {CITIES.map((c) => <option key={c.city} value={c.city}>{c.city} ({c.timezone === 'Asia/Jakarta' ? 'WIB' : 'WITA'})</option>)}
        </Select>
        <p className="hint">Pilihan kota mengisi koordinat perkiraan dan zona waktu. Sesuaikan koordinat dengan lokasi masjid, lalu simpan untuk mengambil jadwal terbaru dari Aladhan.</p>

        <div className="form-row">
          <div>
            <label>Kota</label>
            <input value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div>
            <label>Provinsi</label>
            <input value={form.province || ''} onChange={(e) => set('province', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Latitude</label>
            <input type="number" step="0.000001" value={form.latitude ?? ''} onChange={(e) => set('latitude', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
          <div>
            <label>Longitude</label>
            <input type="number" step="0.000001" value={form.longitude ?? ''} onChange={(e) => set('longitude', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
        </div>
        <p className="hint">Gunakan koordinat lokasi masjid agar jadwal sholat akurat. Contoh: cari nama kota Anda di Google Maps lalu salin koordinatnya.</p>

        <label>Zona Waktu</label>
        <Select value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
          <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
          <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
          <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
        </Select>

        <label>Teks Berjalan</label>
        <textarea value={form.runningText || ''} onChange={(e) => set('runningText', e.target.value)} rows={3} />

        <div className="form-actions"><button type="button" className="secondary" disabled={saving} onClick={() => { if (savedForm) setForm({ ...savedForm }); setMessage(null); }}>↶ Reset</button><button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button></div>
      </form>
      <aside className="mosque-settings-side">
        <section className="form-panel"><h2 className="form-section-title">Logo Masjid</h2><p className="hint">Pilih logo untuk identitas mushola pada layar informasi.</p>
          <div className="mosque-logo-preview"><img src={form.logo || '/mosque-logo.svg'} className={form.logo ? '' : 'default-logo'} alt="Preview logo masjid"/></div>
          <label className="mosque-logo-picker">↑ Pilih Gambar<input type="file" accept="image/png,image/jpeg" disabled={saving} onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
            if (!['image/png','image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) { setMessage('Gagal: Pilih gambar PNG/JPG maksimal 2 MB.'); return; }
            const url = URL.createObjectURL(file);
            try {
              const img = new Image(); img.src = url; await img.decode();
              const canvas = document.createElement('canvas'); const ratio = Math.min(1,256 / Math.max(img.width,img.height));
              canvas.width = Math.round(img.width * ratio); canvas.height = Math.round(img.height * ratio);
              const context = canvas.getContext('2d'); if (!context) throw new Error('Gambar tidak dapat diproses.');
              context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(img,0,0,canvas.width,canvas.height);
              const logo = canvas.toDataURL('image/jpeg',0.85);
              setForm(current => current ? { ...current, logo } : current); setMessage(null);
            } catch { setMessage('Gagal: Gambar tidak dapat dibaca.'); } finally { URL.revokeObjectURL(url); }
          }}/></label>
          <p className="hint mosque-logo-hint">Format PNG, JPG (maks. 2 MB).<br/>Disarankan gambar persegi. Klik Simpan Perubahan untuk menyimpan logo.</p>
          {form.logo && <button type="button" className="secondary" disabled={saving} onClick={() => set('logo','')}>Gunakan Logo Default</button>}
        </section>
        <section className="form-panel"><h2 className="form-section-title">Preview Tampilan</h2><p className="hint">Pratinjau identitas sebelum perubahan disimpan.</p><div className="mosque-identity-preview"><img src={form.logo || '/mosque-logo.svg'} alt=""/><strong>{form.name || 'Nama Masjid'}</strong><span>Rumah Allah, Rumah Kita</span><small>{[form.city,form.province].filter(Boolean).join(', ')}</small></div></section>
      </aside>
      </div>
      <footer className="mosque-settings-quote">“Dirikanlah sholat, sesungguhnya sholat<br/>mencegah dari perbuatan keji dan mungkar.”<small>(QS. Al-'Ankabut: 45)</small></footer>
    </div>
  );
}
