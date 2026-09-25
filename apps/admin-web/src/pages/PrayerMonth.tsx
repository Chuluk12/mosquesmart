import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface MonthSchedule {
  city: string; timezone: string; method: string; today: string;
  expectedDays: number; complete: boolean; warning: string | null;
  days: { date: string; effective: Record<string, string> }[];
}

export function PrayerMonth({ revision, methodControl, onGenerate }: { revision: number; methodControl: React.ReactNode; onGenerate: () => Promise<boolean> }) {
  const [month, setMonth] = useState('');
  const [data, setData] = useState<MonthSchedule | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    api.get<{ now: { date: string } }>('/prayers/today')
      .then(value => setMonth(value.now.date.slice(0, 7)))
      .catch(() => { const now = new Date(); setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`); });
  }, []);
  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    let cancelled = false;
    setBusy(true); setError(''); setData(null);
    const [year, number] = month.split('-').map(Number);
    const path = `/prayers/month/${year}/${number}`;
    const request = refresh ? api.post<MonthSchedule>(`${path}/refresh`) : api.get<MonthSchedule>(path);
    request.then(value => { if (!cancelled) setData(value); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [month, revision, refresh]);
  const monthLabel = month ? new Date(`${month}-01T12:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '';
  const exportCsv = () => {
    if (!data) return;
    const rows = [['Tanggal','Hari','Subuh','Dzuhur','Ashar','Maghrib','Isya'], ...data.days.map(day => [day.date, new Date(`${day.date}T12:00:00`).toLocaleDateString('id-ID',{weekday:'long'}), ...['fajr','dhuhr','asr','maghrib','isha'].map(key => day.effective[key])])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `jadwal-sholat-${month}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  return <><section className="form-panel prayer-month-banner">
    <div className="prayer-month-controls">
    <h2>Jadwal Sholat Bulanan</h2>
    <p className="hint">Pilih bulan dan metode untuk mengambil jadwal berdasarkan lokasi masjid yang telah diatur pada Identitas Masjid.</p>
    <div className="form-row">
      <div><label htmlFor="prayer-month">Bulan jadwal</label><input id="prayer-month" type="month" min="2000-01" max="2100-12" value={month} onChange={e => { setRefresh(0); setMonth(e.target.value); }} /></div>
      {methodControl}
      <div className="form-actions"><button type="button" disabled={busy || !month} onClick={async () => { setBusy(true); if (await onGenerate()) setRefresh(value => value + 1); else setBusy(false); }}>{busy ? 'Memuat jadwal...' : '↻ Ambil Jadwal API'}</button></div>
    </div>
    </div>
    <aside className="prayer-location"><strong>⌖ Lokasi Masjid</strong><b>{data?.city || 'Sesuai Identitas Masjid'}</b><span>Zona waktu: {data?.timezone || '—'}</span><span>Metode: {data?.method || '—'}</span></aside>
  </section>
  <section className="form-panel prayer-results">
    <div className="prayer-results-heading"><h2>▦ Hasil Jadwal Sholat{monthLabel && ` — ${monthLabel}`}</h2><div className="form-actions"><button type="button" className="secondary" disabled={!data?.days.length || busy} onClick={exportCsv}>Ekspor CSV (Excel)</button><button type="button" className="secondary" disabled={!data?.days.length || busy} onClick={() => window.print()}>Cetak</button></div></div>
    {error && <p className="alert-error" role="alert">{error}</p>}
    {data && <>
      <p><strong>{data.city || 'Lokasi masjid'}</strong> · {data.timezone} · {data.method} · {data.days.length}/{data.expectedDays} hari tersimpan</p>
      {data.warning && <p className="alert-error" role="status">{data.warning}</p>}
      <p className="hint">Waktu sudah termasuk koreksi menit. Display dan jadwal audio relatif terhadap sholat menggunakan jadwal tanggal berjalan.</p>
      <div className="prayer-month-scroll" tabIndex={0} role="region" aria-label="Jadwal sholat bulanan, gulir untuk melihat tanggal lainnya">
        <table className="data-table prayer-month-table">
          <thead><tr>{['Tanggal', 'Hari', 'Subuh', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{data.days.map(day => <tr key={day.date} style={day.date === data.today ? { background: '#dff2ff', fontWeight: 700 } : undefined}>
            <td>{new Date(`${day.date}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
            <td>{new Date(`${day.date}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long' })}{day.date === data.today && <small className="prayer-today-label">Hari ini</small>}</td>
            {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map(key => <td key={key}>{day.effective[key]}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {!data.days.length && <p>Belum ada jadwal tersimpan untuk bulan ini. Periksa koneksi internet, lalu klik Perbarui dari API.</p>}
    </>}
  </section></>;
}
