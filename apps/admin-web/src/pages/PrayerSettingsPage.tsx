import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PrayerMonth } from './PrayerMonth';
import { CalculationMethodSelect } from './CalculationMethodSelect';
import './prayer-settings.css';
import { useAuth } from '../contexts/AuthContext';

interface PrayerSetting {
  calculationMethod: string;
  fajrOffsetMin: number; dhuhrOffsetMin: number; asrOffsetMin: number; maghribOffsetMin: number; ishaOffsetMin: number;
  fajrIqomahMin: number; dhuhrIqomahMin: number; asrIqomahMin: number; maghribIqomahMin: number; ishaIqomahMin: number;
}

const PRAYERS: { key: string; label: string }[] = [
  { key: 'fajr', label: 'Subuh' }, { key: 'dhuhr', label: 'Dzuhur' }, { key: 'asr', label: 'Ashar' },
  { key: 'maghrib', label: 'Maghrib' }, { key: 'isha', label: 'Isya' },
];

export function PrayerSettingsPage() {
  const { user } = useAuth();
  const [clock, setClock] = useState(new Date());
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  useEffect(() => { api.get<{timezone:string}>('/mosque').then(m => setTimezone(m.timezone)).catch(() => {}); const timer = setInterval(() => setClock(new Date()),1000); return () => clearInterval(timer); }, []);
  const [form, setForm] = useState<PrayerSetting | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => api.get<PrayerSetting>('/prayers/settings').then(setForm);
  useEffect(() => { load(); }, []);

  if (!form) return <p>Memuat...</p>;

  const setField = (key: keyof PrayerSetting, value: number | string) => setForm({ ...form, [key]: value });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/prayers/settings', form);
      setMessage('Tersimpan.');
      setRevision(value => value + 1);
      return true;
    } catch (err) {
      setMessage(`Gagal: ${(err as Error).message}`);
      return false;
    } finally {
      setSaving(false);
    }
  };
  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); void save(); };

  return (
    <div className="prayer-settings-page">
      <header><div><small>✧ JADWAL SHOLAT</small><h1>Jadwal Sholat</h1><p>Kelola jadwal waktu sholat harian berdasarkan lokasi masjid.</p></div><div className="prayer-header-clock"><span><b>{clock.toLocaleDateString('id-ID', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b><small>{clock.toLocaleDateString('id-ID-u-ca-islamic', { timeZone: timezone, day: 'numeric', month: 'long', year: 'numeric' })}</small></span><strong>{clock.toLocaleTimeString('id-ID', { timeZone: timezone, hourCycle: 'h23' }).replaceAll('.', ':')}</strong></div><div className="prayer-header-user"><span>{user?.name?.charAt(0)}</span><div><b>{user?.name}</b><small>● Sesi aktif</small></div></div></header>
      {message && <div className={message.startsWith('Gagal') ? 'alert-error' : 'alert-success'}>{message}</div>}
      <PrayerMonth revision={revision} onGenerate={save} methodControl={<CalculationMethodSelect value={form.calculationMethod} onChange={value => setField('calculationMethod', value)} />} />
      <form className="form-panel prayer-calculation" onSubmit={onSubmit}>
        <div className="prayer-results-heading"><h2>⚙ Pengaturan Perhitungan</h2><button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</button></div>
        <p className="hint">Metode dipilih pada panel di atas. Koreksi waktu dan durasi iqomah diterapkan ke jadwal display serta audio.</p>

        <h3>Koreksi Waktu (menit)</h3>
        <table className="settings-table">
          <thead><tr><th>Sholat</th><th>Offset (menit)</th><th>Durasi Iqomah (menit)</th></tr></thead>
          <tbody>
            {PRAYERS.map(({ key, label }) => (
              <tr key={key}>
                <td>{label}</td>
                <td><input type="number" value={(form as any)[`${key}OffsetMin`]} onChange={(e) => setField(`${key}OffsetMin` as any, Number(e.target.value))} /></td>
                <td><input type="number" min={0} value={(form as any)[`${key}IqomahMin`]} onChange={(e) => setField(`${key}IqomahMin` as any, Number(e.target.value))} /></td>
              </tr>
            ))}
          </tbody>
        </table>

      </form>
    </div>
  );
}

