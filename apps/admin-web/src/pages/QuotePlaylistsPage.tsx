import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import './quote-playlists.css';
import { Select } from '../components/Select';

type Audio = { id: string; name: string; description?: string | null; isActive?: boolean };
type Settings = { name: string; times: string[]; daysOfWeek: number[]; volume: number; isActive: boolean };
type Playlist = Settings & {
  id: string; updatedAt: string; cycle: number; audioIds: string[]; audios: Audio[];
  remaining: number; usedCount: number; pending: number; timezone: string;
  approvals: { id: string; cycle: number; approvedBy: string; approvedAt: string }[];
  recentRuns: { id: string; slot: string; audioName: string; status: string; cycle: number; audioId: string | null }[];
};
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const defaults = (): Settings => ({
  name: 'Quotes Harian', times: ['08:00'],
  daysOfWeek: [1, 2, 3, 4, 5], volume: 80, isActive: false,
});
const statusText: Record<string, string> = { LOADING: 'Menunggu player', PLAYING: 'Sedang diputar', FINISHED: 'Selesai', STOPPED: 'Dihentikan', ERROR: 'Gagal', REVIEWED: 'Dikonfirmasi admin (terpakai)' };

function QuoteIcon({ name, tone = 'blue' }: { name: string; tone?: string }) {
  const paths: Record<string, string> = {
    info: 'M7 3h8l4 4v14H5V3h2m8 0v5h4M9 12h6m-6 4h6',
    clock: 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
    audio: 'M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-3-3h3m11 1a3 3 0 1 1-3-3h3',
    volume: 'M11 4 5 9H2v6h3l6 5V4m4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    stock: 'M4 6c0-4 16-4 16 0s-16 4-16 0m0 0v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0',
    play: 'm9 7 8 5-8 5V7M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
    calendar: 'M4 5h16v16H4V5m4-3v6m8-6v6M4 11h16m-12 4h2m4 0h2',
  };
  return <span className={'quote-icon ' + tone}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.info}/></svg></span>;
}
function SectionTitle({ icon, title, description, tone }: { icon: string; title: string; description?: string; tone?: string }) {
  return <div className="quote-section-title"><QuoteIcon name={icon} tone={tone}/><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>;
}
export function QuotePlaylistsPage() {
  const { user } = useAuth();
  const canEdit = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(user?.role || '');
  const canApprove = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [audios, setAudios] = useState<Audio[]>([]);
  const [form, setForm] = useState<Settings>(defaults);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteAudioId, setDeleteAudioId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState<Record<string, string>>({});
  const [historyStatus, setHistoryStatus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [approval, setApproval] = useState<Playlist | null>(null);
  const [deletePlaylistId, setDeletePlaylistId] = useState<string | null>(null);
  const [removeVoiceId, setRemoveVoiceId] = useState<string | null>(null);
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [voiceTitle, setVoiceTitle] = useState('');
  const [voiceText, setVoiceText] = useState('');
  async function load() {
    const [p, a] = await Promise.all([api.get<Playlist[]>('/quote-playlists'), api.get<Audio[]>('/audio?activeOnly=true')]);
    setPlaylists(p); setAudios(a);
  }
  useEffect(() => {
    let alive = true;
    const refresh = () => { if (alive) load().catch(e => { if (alive) setError(e.message); }); };
    refresh(); const timer = window.setInterval(refresh, 20000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);
  async function action(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); await load(); setMessage(success); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  function reset() { setEditing(null); setForm(defaults()); setSelected([]); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.daysOfWeek.length || new Set(form.times).size !== form.times.length || (!editing && !selected.length)) {
      setError('Pilih minimal satu hari dan audio. Jam pemutaran tidak boleh sama.'); return;
    }
    await action(async () => {
      if (editing) await api.patch('/quote-playlists/' + editing, form);
      else await api.post('/quote-playlists', { ...form, audioIds: selected });
      reset();
    }, 'Playlist tersimpan. Aktifkan player pada perangkat speaker agar audio dapat diputar.');
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    await action(async () => {
      const ids: string[] = [];
      let failures = 0;
      for (const file of list) {
        const data = new FormData(); data.append('file', file);
        data.append('name', file.name.replace(/\.[^.]+$/, '')); data.append('category', 'ANNOUNCEMENT');
        try { const audio = await api.upload<Audio>('/audio/upload', data); ids.push(audio.id); }
        catch { failures++; }
      }
      setSelected(prev => [...new Set([...prev, ...ids])]);
      if (failures) setError(failures + ' file gagal diunggah. File yang berhasil tetap dipilih; unggah ulang hanya file yang gagal.');
    }, 'Unggah selesai. Pilih audio dan simpan playlist.');
  }
  function startVoiceEdit(playlistId: string, audio: Audio) {
    setEditingVoiceId(playlistId + '|' + audio.id); setVoiceTitle(audio.name); setVoiceText(audio.description || '');
    setRemoveVoiceId(null); setError(''); setMessage('');
  }
  async function saveVoice(audioId: string) {
    if (!voiceTitle.trim()) { setError('Judul voice tidak boleh kosong.'); return; }
    await action(async () => {
      await api.patch('/audio/' + audioId, { name: voiceTitle.trim(), description: voiceText.trim() });
      setEditingVoiceId(null);
    }, 'Judul dan teks voice diperbarui. File suara yang sudah direkam tetap sama.');
  }
  const visible = audios.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="quote-page">
    <header><span className="hint">AUDIO</span><h1>Playlist Quotes</h1>
      <p>Putar satu audio quotes secara acak pada setiap jadwal, tanpa pengulangan dalam satu putaran.</p></header>
    {error && <p className="alert-error" role="alert">{error}</p>}
    {message && <p className="alert-success" role="status">{message}</p>}

    {canEdit && <form className="quote-editor" onSubmit={save}>
      <fieldset disabled={busy}>
        <section className="quote-panel">
          <SectionTitle icon="info" title={editing ? 'Edit Informasi Playlist' : 'Informasi Playlist'} description="Atur nama playlist dan hari pemutaran."/>
          <div className="quote-info-grid">
            <label>Nama playlist<input required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/><small className="quote-counter">{form.name.length}/100</small></label>
            <div><span className="quote-label">Hari pemutaran</span><div className="quote-days">{DAYS.map((day, i) => <label key={day}><input type="checkbox" checked={form.daysOfWeek.includes(i)} onChange={e => setForm({ ...form, daysOfWeek: e.target.checked ? [...form.daysOfWeek, i] : form.daysOfWeek.filter(d => d !== i) })}/>{day}</label>)}</div></div>
          </div>
        </section>
        <section className="quote-panel">
          <div className="quote-section-bar"><SectionTitle icon="clock" tone="green" title="Jadwal Pemutaran" description="Tentukan waktu pemutaran untuk setiap jam."/>
            <button type="button" className="secondary" disabled={form.times.length >= 24} onClick={() => setForm({ ...form, times: [...form.times, ''] })}>+ Tambah Jam</button></div>
          <div className="quote-times">{form.times.map((time, i) => <div className="quote-time-card" key={i}>
            <div className="quote-time-top"><span><i/>Jam {i + 1}</span><button type="button" className="quote-delete" title={'Hapus jam ' + (i + 1)} aria-label={'Hapus jam ' + (i + 1)} disabled={form.times.length === 1} onClick={() => setForm({ ...form, times: form.times.filter((_, j) => j !== i) })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg></button></div>
            <input aria-label={'Waktu jam ' + (i + 1)} type="time" required value={time} onChange={e => setForm({ ...form, times: form.times.map((t, j) => j === i ? e.target.value : t) })}/>
            <small className="quote-time-caption">1 audio per jadwal</small>
          </div>)}</div>
        </section>
        <section className="quote-panel quote-volume-panel">
          <SectionTitle icon="volume" tone="purple" title="Volume Pemutaran" description="Atur volume audio quotes."/>
          <div className="quote-volume-control"><input aria-label="Volume pemutaran" type="range" min="0" max="100" value={form.volume} onChange={e => setForm({ ...form, volume: +e.target.value })}/><output>{form.volume}%</output></div>
        </section>
        {!editing && <section className="quote-panel">
          <SectionTitle icon="audio" title="Kumpulan Audio" description="Upload MP3 / WAV atau pilih audio yang sudah ada di Audio Library."/>
          <label className="quote-upload">Upload beberapa audio<input type="file" multiple accept=".mp3,.wav" onChange={e => { void upload(e.target.files); e.target.value = ''; }}/></label>
          <div className="quote-section-bar"><input aria-label="Cari audio quotes" placeholder="Cari audio..." value={search} onChange={e => setSearch(e.target.value)}/>
            <div className="quote-actions"><button type="button" className="secondary" onClick={() => setSelected(prev => [...new Set([...prev, ...visible.map(a => a.id)])])}>Pilih semua hasil</button><button type="button" className="secondary" onClick={() => setSelected([])}>Kosongkan</button><span>{selected.length} dipilih</span></div></div>
          <div className="quote-audios">{visible.map(a => <div className="quote-audio-choice" key={a.id}><label><input type="checkbox" checked={selected.includes(a.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id))}/>{a.name}</label>
            {canApprove && <button type="button" className="quote-audio-delete" disabled={busy} onClick={() => setDeleteAudioId(a.id)}>Hapus</button>}
            {deleteAudioId === a.id && <div className="quote-confirm quote-audio-confirm"><p>Hapus file <strong>{a.name}</strong> permanen dari Audio Library? Audio yang masih dipakai jadwal atau playlist akan ditolak.</p><div className="quote-actions"><button type="button" className="quote-danger-button" disabled={busy} onClick={() => action(async () => { await api.delete('/audio/' + a.id); setSelected(prev => prev.filter(id => id !== a.id)); setDeleteAudioId(null); }, 'Audio dihapus dari Audio Library.')}>Ya, hapus file</button><button type="button" className="secondary" onClick={() => setDeleteAudioId(null)}>Batal</button></div></div>}</div>)}
            {!visible.length && <p>Tidak ada audio yang cocok. Unggah audio atau ubah pencarian.</p>}</div>
        </section>}
        <div className="quote-editor-footer"><label className="quote-switch"><input type="checkbox" role="switch" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}/><span/>Aktifkan playlist</label>
          <div className="quote-actions"><button type="button" className="secondary" onClick={reset}>Batal / Reset</button><button type="submit">{busy ? 'Menyimpan...' : 'Simpan Playlist'}</button></div></div>
      </fieldset>
    </form>}    <div className="quote-actions"><h2>Daftar Playlist</h2><button type="button" className="secondary" disabled={busy} onClick={() => action(load, 'Daftar diperbarui.')}>Refresh</button></div>
    {!playlists.length && <p className="quote-panel">Belum ada playlist quotes.</p>}
    {playlists.map(p => <section className="quote-panel" key={p.id}>
      <div className="quote-playlist-heading">
        <div className="quote-section-title"><QuoteIcon name="audio"/><div><div className="quote-actions"><h2>{p.name}</h2><span className={'quote-badge ' + (p.isActive ? 'FINISHED' : 'STOPPED')}>{p.isActive ? 'Aktif' : 'Nonaktif'}</span></div><p>Putaran {p.cycle}{p.updatedAt && <> · Terakhir diperbarui {new Date(p.updatedAt).toLocaleString('id-ID', { timeZone: p.timezone })}</>}</p></div></div>
        <div className="quote-actions">
          {canEdit && <button type="button" className="secondary" disabled={busy} onClick={() => { setEditing(p.id); setForm({ name: p.name, times: [...p.times], daysOfWeek: [...p.daysOfWeek], volume: p.volume, isActive: p.isActive }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit Playlist</button>}
          {canEdit && <button type="button" className="secondary" disabled={busy} onClick={() => action(() => api.patch('/quote-playlists/' + p.id, { name: p.name, times: p.times, daysOfWeek: p.daysOfWeek, volume: p.volume, isActive: !p.isActive }), 'Status playlist diperbarui.')}>{p.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>}
          {canApprove && <button type="button" disabled={busy || p.remaining > 0 || p.pending > 0 || !p.audios.length} onClick={() => setApproval(p)}>Setujui Putar Ulang</button>}
          {canApprove && <button type="button" className="quote-danger-button" disabled={busy} onClick={() => { setDeletePlaylistId(p.id); setApproval(null); }}>Hapus Playlist</button>}
        </div>
      </div>
      {deletePlaylistId === p.id && <div className="quote-confirm" role="region" aria-label={'Konfirmasi hapus playlist ' + p.name}>
        <p>Hapus playlist <strong>{p.name}</strong> beserta riwayat dan persetujuan ulangnya? File voice tetap tersimpan di Audio Library.</p>
        <div className="quote-actions"><button type="button" className="quote-danger-button" disabled={busy} onClick={() => action(async () => { await api.delete('/quote-playlists/' + p.id); setDeletePlaylistId(null); if (editing === p.id) reset(); }, 'Playlist dihapus.')}>Ya, hapus playlist</button><button type="button" className="secondary" onClick={() => setDeletePlaylistId(null)}>Batal</button></div>
      </div>}
      <div className="quote-stats">
        {[{ value: p.audioIds.length, label: 'Total audio', icon: 'audio', tone: 'blue' }, { value: p.remaining, label: 'Tersedia', icon: 'stock', tone: 'orange' }, { value: p.usedCount, label: 'Terpakai / dicadangkan', icon: 'play', tone: 'green' }, { value: p.pending, label: 'Menunggu / diputar', icon: 'clock', tone: 'purple' }].map(stat => <div className={'quote-stat ' + stat.tone} key={stat.label}><QuoteIcon name={stat.icon} tone={stat.tone}/><div><strong>{stat.value}</strong><span>{stat.label}</span></div></div>)}
      </div>
      <details className="quote-voice-list"><summary>Daftar Voice ({p.audios.length})</summary>
        <div className="quote-voice-items">{p.audios.map(a => <div className="quote-voice-item" key={a.id}>
          {editingVoiceId === p.id + '|' + a.id ? <div className="quote-voice-edit"><label>Judul voice<input maxLength={150} value={voiceTitle} onChange={e => setVoiceTitle(e.target.value)}/></label><label>Teks quotes / deskripsi<textarea rows={3} value={voiceText} onChange={e => setVoiceText(e.target.value)}/></label><small>Mengubah teks di sini tidak mengubah suara pada file rekaman.</small><div className="quote-actions"><button type="button" disabled={busy || !voiceTitle.trim()} onClick={() => void saveVoice(a.id)}>Simpan</button><button type="button" className="secondary" onClick={() => setEditingVoiceId(null)}>Batal</button></div></div> : <><div className="quote-voice-text"><strong>{a.name}</strong>{a.description && <p>{a.description}</p>}{a.isActive === false && <small>Nonaktif di Audio Library</small>}</div>{canEdit && <div className="quote-actions"><button type="button" className="secondary" disabled={busy} onClick={() => startVoiceEdit(p.id, a)}>Edit judul / teks</button><button type="button" className="quote-danger-button" disabled={busy} onClick={() => { setRemoveVoiceId(p.id + '|' + a.id); setEditingVoiceId(null); }}>Hapus dari playlist</button></div>}</>}
          {removeVoiceId === p.id + '|' + a.id && <div className="quote-confirm quote-voice-confirm"><p>Keluarkan <strong>{a.name}</strong> dari playlist {p.name}? File tetap ada di Audio Library.</p><div className="quote-actions"><button type="button" className="quote-danger-button" disabled={busy || p.audioIds.length <= 1} onClick={() => action(async () => { await api.patch('/quote-playlists/' + p.id + '/audios', { audioIds: p.audioIds.filter(id => id !== a.id) }); setRemoveVoiceId(null); }, 'Voice dikeluarkan dari playlist.')}>Ya, keluarkan</button><button type="button" className="secondary" onClick={() => setRemoveVoiceId(null)}>Batal</button></div>{p.audioIds.length <= 1 && <small>Playlist harus memiliki minimal satu voice. Hapus playlist jika sudah tidak digunakan.</small>}</div>}
        </div>)}</div>
      </details>
      <div className="quote-schedule-strip"><SectionTitle icon="calendar" title="Jadwal Pemutaran" description={p.daysOfWeek.map(d => DAYS[d]).join(', ')}/>
        <div className="quote-time-tags">{p.times.map(t => <span key={t}>{t}</span>)}</div>
        <div className="quote-volume-readout"><span>Volume <strong>{p.volume}%</strong></span><meter aria-label="Volume playlist" min={0} max={100} value={p.volume}/><small>{p.timezone}</small></div>
      </div>      {p.remaining === 0 && <p className="quote-note">{p.pending ? 'Menunggu hasil pemutaran terakhir sebelum persetujuan ulang.' : 'Stok habis. Tidak ada audio yang diulang sampai admin menyetujui putaran baru.'}</p>}
      {p.pending > 0 && <p className="hint">Jika koneksi player terputus sebelum memberi hasil, audio tetap dikunci untuk mencegah pengulangan. Periksa History dan sambungkan kembali player.</p>}
      {approval?.id === p.id && <div className="quote-note" role="region" aria-label="Konfirmasi pengulangan">
        <p>Izinkan seluruh audio aktif pada <strong>{p.name}</strong> diputar kembali secara acak pada jadwal berikutnya? Persetujuan ini dicatat atas akun Anda.</p>
        <div className="quote-actions"><button type="button" disabled={busy} onClick={() => action(async () => { await api.post('/quote-playlists/' + p.id + '/approve-repeat', { cycle: approval.cycle }); setApproval(null); }, 'Putaran baru disetujui. Audio akan diputar pada jadwal berikutnya.')}>Ya, setujui putaran baru</button><button type="button" className="secondary" onClick={() => setApproval(null)}>Batal</button></div>
      </div>}
      <details className="quote-history" open><summary>Riwayat Playlist ({p.recentRuns.length} terbaru)</summary>        <div className="quote-history-filters"><input aria-label={'Cari riwayat ' + p.name} placeholder="Cari audio..." value={historySearch[p.id] || ''} onChange={e => setHistorySearch({ ...historySearch, [p.id]: e.target.value })}/>
          <Select aria-label={'Filter status ' + p.name} value={historyStatus[p.id] || ''} onChange={e => setHistoryStatus({ ...historyStatus, [p.id]: e.target.value })}><option value="">Semua Status</option>{Object.entries(statusText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
        <div className="quote-table"><table><thead><tr><th>No</th><th>Jadwal</th><th>Audio</th><th>Putaran</th><th>Status</th></tr></thead><tbody>
          {p.recentRuns.filter(r => r.audioName.toLowerCase().includes((historySearch[p.id] || '').toLowerCase()) && (!historyStatus[p.id] || r.status === historyStatus[p.id])).map((r, index) => <tr key={r.id}><td>{index + 1}</td><td>{r.slot}</td><td><span className="quote-history-audio"><QuoteIcon name="play"/>{r.audioName}</span></td><td>{r.cycle}</td><td><span className={"quote-badge " + r.status}>{statusText[r.status] || r.status}</span>{r.audioId === null ? ' — stok dikembalikan' : ''}{canApprove && ['LOADING', 'PLAYING'].includes(r.status) && <div>
          {resolveId === r.id ? <><p>Pastikan perangkat sudah berhenti. Audio tetap dianggap terpakai. Tindakan hanya tersedia saat player offline.</p><button type="button" disabled={busy} onClick={() => action(async () => { await api.post('/quote-playlists/' + p.id + '/runs/' + r.id + '/resolve'); setResolveId(null); }, 'Pemutaran terputus ditutup; audio tetap terkunci sampai persetujuan ulang.')}>Konfirmasi terpakai</button><button type="button" className="secondary" onClick={() => setResolveId(null)}>Batal</button></> : <button type="button" className="secondary" onClick={() => setResolveId(r.id)}>Tangani koneksi terputus</button>}
        </div>}</td></tr>)}
        </tbody></table></div>{!p.recentRuns.length && <p>Belum ada pemutaran.</p>}
      </details>
      {p.approvals.length > 0 && <details><summary>Riwayat persetujuan ulang</summary>{p.approvals.map(a => <p key={a.id}>Putaran {a.cycle} · {new Date(a.approvedAt).toLocaleString('id-ID', { timeZone: p.timezone })} · ID admin: {a.approvedBy}</p>)}</details>}
    </section>)}
  </div>;
}