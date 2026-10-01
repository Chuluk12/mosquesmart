import {Select} from '../components/Select';
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import './audio-schedule.css';

interface Audio { id: string; name: string }
interface AudioSchedule {
  id: string; audioId: string; maxDurationMinutes?: number | null; resumePlayback?: boolean; resumePositionSeconds?: number; audio?: Audio; scheduleType: 'FIXED_TIME' | 'PRAYER_RELATIVE';
  daysOfWeek?: number[]; prayerName?: string; offsetMinutes?: number; fixedTime?: string; volume: number; isActive: boolean;
}

const DAYS = [{id:1,label:'Senin'},{id:2,label:'Selasa'},{id:3,label:'Rabu'},{id:4,label:'Kamis'},{id:5,label:'Jumat'},{id:6,label:'Sabtu'},{id:0,label:'Minggu'}];
const ALL_DAYS = DAYS.map(day=>day.id);
const daySummary = (days?: number[]) => !days?.length || days.length===7 ? 'Setiap hari' : `Setiap ${DAYS.filter(day=>days.includes(day.id)).map(day=>day.label).join(', ')}`;
const PRAYERS = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA'];
const LABELS: Record<string,string> = { FAJR:'Subuh', DHUHR:'Dzuhur', ASR:'Ashar', MAGHRIB:'Maghrib', ISHA:'Isya' };
interface Upcoming { serverNow: string; timezone: string; items: { id: string; atUtc: string | null; reason: string | null }[] }

export function AudioSchedulePage() {
  const { user } = useAuth();
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('');
  const [items, setItems] = useState<AudioSchedule[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [clockOffset, setClockOffset] = useState(0);
  const [countdownError, setCountdownError] = useState(false);
  const refreshCountdown = () => api.get<Upcoming>('/audio-schedules/upcoming').then(data => {
    setUpcoming(data); setClockOffset(Date.parse(data.serverNow) - Date.now()); setCountdownError(false);
  }).catch(() => setCountdownError(true));
  useEffect(() => {
    const clockTimer = setInterval(() => setClock(Date.now()), 1000);
    const syncTimer = setInterval(refreshCountdown, 20_000);
    return () => { clearInterval(clockTimer); clearInterval(syncTimer); };
  }, []);
  const [editing, setEditing] = useState<AudioSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [audios, setAudios] = useState<Audio[]>([]);
  const [scheduleType, setScheduleType] = useState<'FIXED_TIME' | 'PRAYER_RELATIVE'>('PRAYER_RELATIVE');
  const [audioId, setAudioId] = useState('');
  const [prayerName, setPrayerName] = useState('DHUHR');
  const [offsetMinutes, setOffsetMinutes] = useState(-10);
  const [fixedTime, setFixedTime] = useState('07:30');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(ALL_DAYS);
  const [volume, setVolume] = useState(80);
  const [resumePlayback, setResumePlayback] = useState(false);
  const [maxDurationMinutes, setMaxDurationMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void refreshCountdown();
    api.get<AudioSchedule[]>('/audio-schedules').then(setItems).catch((err) => setError(err.message));
    api.get<Audio[]>('/audio?activeOnly=true').then(setAudios).catch(err => setError(err.message));
  };
  useEffect(() => { load(); }, []);

  const reset = () => {
    setDaysOfWeek(ALL_DAYS);
    setResumePlayback(false);
    setMaxDurationMinutes('');
    setEditing(null); setAudioId(''); setScheduleType('PRAYER_RELATIVE');
    setPrayerName('DHUHR'); setOffsetMinutes(-10); setFixedTime('07:30'); setVolume(80);
  };
  const edit = (schedule: AudioSchedule) => {
    setDaysOfWeek(schedule.daysOfWeek?.length ? schedule.daysOfWeek : ALL_DAYS);
    setResumePlayback(!!schedule.resumePlayback);
    setMaxDurationMinutes(schedule.maxDurationMinutes == null ? '' : String(schedule.maxDurationMinutes));
    setEditing(schedule); setAudioId(schedule.audioId); setScheduleType(schedule.scheduleType);
    setPrayerName(schedule.prayerName || 'DHUHR'); setOffsetMinutes(schedule.offsetMinutes ?? -10);
    setFixedTime(schedule.fixedTime || '07:30'); setVolume(schedule.volume); setError(null); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioId) { setError('Pilih audio terlebih dahulu.'); return; }
    if (!daysOfWeek.length) { setError('Pilih minimal satu hari pengulangan.'); return; }
    setError(null);
    setMessage(''); setSaving(true);
    try {
      const payload = {
        audioId, scheduleType, daysOfWeek, volume, resumePlayback, maxDurationMinutes: maxDurationMinutes === '' ? null : Number(maxDurationMinutes),
        ...(scheduleType === 'PRAYER_RELATIVE' ? { prayerName, offsetMinutes } : { fixedTime }),
      };
      if (editing) await api.patch(`/audio-schedules/${editing.id}`, payload);
      else await api.post('/audio-schedules', payload);
      setMessage(editing ? 'Perubahan jadwal tersimpan.' : 'Jadwal berhasil ditambahkan.');
      reset();
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: AudioSchedule) => { try { await api.patch(`/audio-schedules/${s.id}`, { isActive: !s.isActive }); load(); } catch(err) { setError((err as Error).message); } };
  const remove = async (id: string) => { if (confirm('Hapus jadwal ini?')) { try { await api.delete(`/audio-schedules/${id}`); load(); } catch(err) { setError((err as Error).message); } } };
  const shown = items.filter(s => (!filter || s.scheduleType === filter) && (s.audio?.name || audios.find(a=>a.id===s.audioId)?.name || '').toLowerCase().includes(query.toLowerCase()));
  const timezone = upcoming?.timezone || 'Asia/Jakarta';

  return (
    <div className="audio-schedule-page">
      <header><div><small>♫ AUDIO</small><h1>Jadwal Audio</h1><p>Atur jadwal pemutaran audio secara otomatis sesuai waktu sholat dan kebutuhan masjid.</p></div><div className="schedule-date"><b>{new Date(clock).toLocaleDateString('id-ID',{timeZone:timezone,weekday:'long',day:'numeric',month:'long',year:'numeric'})}</b><small>{new Date(clock).toLocaleDateString('id-ID-u-ca-islamic',{timeZone:timezone,day:'numeric',month:'long',year:'numeric'})}</small></div><strong className="schedule-clock">{new Date(clock).toLocaleTimeString('id-ID',{timeZone:timezone,hourCycle:'h23'}).replaceAll('.',':')}</strong><div className="schedule-user"><b>{user?.name}</b><small>● Sesi aktif</small></div></header>
      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success" role="status">{message}</div>}

      <div className="schedule-top"><form className="form-panel" onSubmit={onSubmit}>
        <div className="schedule-heading"><span>♫</span><div><h2>{editing ? 'Edit Jadwal Audio' : 'Tambah Jadwal Audio'}</h2><p>Buat jadwal audio baru untuk diputar secara otomatis.</p></div></div>
        <div className="form-row">
          <div>
            <label>Audio</label>
            <Select value={audioId} onChange={(e) => setAudioId(e.target.value)} required>
              <option value="">-- pilih audio --</option>
              {editing && !audios.some(a => a.id === editing.audioId) && <option value={editing.audioId}>{editing.audio?.name || editing.audioId} (Nonaktif)</option>}
              {audios.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div>
            <label>Tipe Jadwal</label>
            <Select value={scheduleType} onChange={(e) => setScheduleType(e.target.value as any)}>
              <option value="PRAYER_RELATIVE">Relatif terhadap Sholat</option>
              <option value="FIXED_TIME">Jam Tetap</option>
            </Select>
          </div>
        </div>

        {scheduleType === 'PRAYER_RELATIVE' ? (
          <div className="form-row">
            <div>
              <label>Sholat</label>
              <Select value={prayerName} onChange={(e) => setPrayerName(e.target.value)}>
                {PRAYERS.map((p) => <option key={p} value={p}>{LABELS[p]}</option>)}
              </Select>
            </div>
            <div>
              <label>Offset (menit, negatif = sebelum)</label>
              <input type="number" required min={-120} max={120} value={offsetMinutes} onChange={(e) => setOffsetMinutes(Number(e.target.value))} />
            </div>
          </div>
        ) : (
          <div>
            <label>Jam (HH:mm)</label>
            <input type="time" required value={fixedTime} onChange={(e) => setFixedTime(e.target.value)} />
          </div>
        )}

        <fieldset className="schedule-days">
          <legend>Hari pengulangan</legend>
          <div className="schedule-day-options">
            <button type="button" className="secondary" onClick={()=>setDaysOfWeek(ALL_DAYS)}>Setiap hari</button>
            <button type="button" className="secondary" onClick={()=>setDaysOfWeek([5])}>Jumat saja</button>
            {DAYS.map(day=><label key={day.id}><input type="checkbox" checked={daysOfWeek.includes(day.id)} onChange={e=>setDaysOfWeek(current=>e.target.checked?[...current,day.id]:current.filter(id=>id!==day.id))}/>{day.label}</label>)}
          </div>
          <p className="hint">Berulang setiap minggu pada hari yang dicentang, mengikuti {timezone}. Tidak perlu memilih tanggal.</p>
        </fieldset>

        <div style={{margin: '16px 0'}}>
          <label htmlFor="max-duration">Batas durasi (menit)</label>
          <input id="max-duration" type="number" min={1} max={1440} step={1} placeholder="Sampai audio selesai" value={maxDurationMinutes} onChange={e => setMaxDurationMinutes(e.target.value)} />
          <p className="hint">Kosongkan untuk memutar sampai selesai. Contoh: isi 20 untuk menghentikan file 40 menit setelah diputar selama 20 menit. File asli tidak berubah.</p>
        </div>
        <label>Volume</label>
        <div className="schedule-volume"><span aria-hidden="true">♪</span><input aria-label="Volume audio" type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} /><output>{volume}%</output></div>
        <div className="form-row"><div>
          <label style={{display:'flex',alignItems:'center',gap:8}}><input style={{width:'auto'}} type="checkbox" checked={resumePlayback} onChange={e=>setResumePlayback(e.target.checked)}/>Lanjutkan dari posisi terakhir</label>
          <p className="hint">Saat batas durasi tercapai, jadwal berikutnya melanjutkan audio yang sama. Setelah audio selesai, jadwal berikutnya mulai dari awal. Mengganti audio atau mengubah opsi ini mereset posisi.</p>
        </div></div>
        <p className="schedule-explanation">ⓘ Audio akan mulai diputar {scheduleType === 'FIXED_TIME' ? `pukul ${fixedTime} (${timezone})` : offsetMinutes === 0 ? `tepat pada waktu ${LABELS[prayerName]}` : `${Math.abs(offsetMinutes)} menit ${offsetMinutes < 0 ? 'sebelum' : 'setelah'} waktu ${LABELS[prayerName]}`} dengan volume {volume}%. {daysOfWeek.length ? daySummary(daysOfWeek) : 'Belum ada hari dipilih'}. {maxDurationMinutes ? `Berhenti otomatis setelah ${maxDurationMinutes} menit, atau lebih awal jika audio selesai.` : 'Diputar sampai audio selesai.'}</p>

        <div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Jadwal'}</button>
          <button type="button" className="secondary" disabled={saving} onClick={() => { reset(); setError(null); }}>{editing ? 'Batal' : '↶ Reset'}</button>
        </div>
      </form>
      <aside className="schedule-guide"><h2>▤ Informasi Jadwal Audio</h2><p>Jadwalkan pemutaran audio otomatis berdasarkan waktu sholat atau jam tertentu.</p><hr/><h3>Tipe Jadwal</h3><div><span>◉</span><p><b>Relatif terhadap Sholat</b><small>Mengikuti jadwal API pada hari yang dipilih. Contoh: 3 menit sebelum adzan.</small></p></div><div><span>◷</span><p><b>Jam Tetap</b><small>Diputar pada hari dan jam yang dipilih sesuai zona waktu mushola.</small></p></div><section><h3>☼ Tips</h3><p>Gunakan nilai negatif (−) untuk sebelum sholat dan positif (+) untuk setelah sholat.</p><p>Pastikan Audio Player online dan speaker terhubung.</p></section></aside></div>

      <section className="form-panel schedule-list"><div className="schedule-list-header"><div className="schedule-heading"><span>▦</span><div><h2>Daftar Jadwal Audio</h2><p>Kelola jadwal dan pantau waktu pemutaran berikutnya.</p></div></div><div className="schedule-filters"><input aria-label="Cari jadwal audio" placeholder="Cari jadwal..." value={query} onChange={e=>setQuery(e.target.value)}/><Select aria-label="Filter tipe jadwal" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Semua Jadwal</option><option value="PRAYER_RELATIVE">Relatif Sholat</option><option value="FIXED_TIME">Jam Tetap</option></Select><button type="button" className="secondary" onClick={load}>↻ Refresh</button></div></div>
      <p className="hint">Hitung mundur menuju jadwal voice berikutnya, mengikuti waktu server dan zona waktu mushola. Audio diputar oleh Audio Player; pemeriksaan jadwal dilakukan setiap 20 detik.</p>

      <div className="schedule-table-scroll"><table className="data-table">
        <thead><tr><th>Audio</th><th>Waktu</th><th>Tipe Jadwal</th><th>Hitung Mundur</th><th>Volume</th><th>Batas Durasi</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>
          {shown.map((s) => (
            <tr key={s.id}>
              <td>{s.audio?.name || audios.find((a) => a.id === s.audioId)?.name || s.audioId}</td>
              <td>{s.scheduleType === 'FIXED_TIME' ? s.fixedTime : `${LABELS[s.prayerName || ''] || s.prayerName} ${s.offsetMinutes! >= 0 ? '+' : ''}${s.offsetMinutes} menit`}<div className="hint">{daySummary(s.daysOfWeek)}</div></td>
              <td><span className="schedule-type">{s.scheduleType === 'FIXED_TIME' ? 'Jam Tetap' : 'Relatif Sholat'}</span></td>
              <td>{(() => {
                if (!s.isActive) return <span className="hint">Jadwal nonaktif</span>;
                if (countdownError) return <span className="hint">Koneksi terputus, mencoba kembali...</span>;
                const next = upcoming?.items.find(item => item.id === s.id);
                if (!next) return <span className="hint">Memuat...</span>;
                if (!next.atUtc) return <span className="hint">{next.reason}</span>;
                const seconds = Math.max(0, Math.ceil((Date.parse(next.atUtc) - clock - clockOffset) / 1000));
                const remaining = [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
                return <><strong style={{ color: '#087bc1', fontSize: 22, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{remaining}</strong>
                  <div className="hint">{seconds === 0 ? 'Waktunya tiba, cek status di History' : new Date(next.atUtc).toLocaleString('id-ID', { timeZone: upcoming!.timezone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</div></>;
              })()}</td>
              <td><div className="schedule-volume-cell"><meter min={0} max={100} value={s.volume} aria-label="Volume"/>{s.volume}%</div></td>
              <td>{s.maxDurationMinutes ? `${s.maxDurationMinutes} menit` : 'Sampai selesai'}{s.resumePlayback && <small style={{display:'block'}}>Lanjut dari {Math.floor((s.resumePositionSeconds||0)/3600).toString().padStart(2,'0')}:{Math.floor((s.resumePositionSeconds||0)%3600/60).toString().padStart(2,'0')}:{Math.floor((s.resumePositionSeconds||0)%60).toString().padStart(2,'0')}</small>}</td>
              <td><button className="chip" onClick={() => toggleActive(s)}>{s.isActive ? 'Aktif' : 'Nonaktif'}</button></td>
              <td><div className="form-actions"><button className="secondary" disabled={saving} onClick={() => edit(s)}>Edit</button><button className="danger" disabled={saving || editing?.id === s.id} onClick={() => remove(s.id)}>Hapus</button></div></td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan={8}>{items.length ? 'Tidak ada jadwal yang sesuai pencarian.' : 'Belum ada jadwal audio.'}</td></tr>}
        </tbody>
      </table></div></section>
    </div>
  );
}
