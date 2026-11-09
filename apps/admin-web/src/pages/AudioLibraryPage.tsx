import { SpeechCreator } from '../components/SpeechCreator';
import { S3Upload, type S3UploadResult } from '../components/S3Upload';
import {Select} from '../components/Select';
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import './audio-library.css';
import { useAuth } from '../contexts/AuthContext';

interface Audio { id: string; name: string; description?: string; category: string; isActive: boolean; fileSize?: number; createdAt?: string }
const CATEGORIES = ['ANNOUNCEMENT', 'MUROTTAL', 'ADHAN', 'PRAYER_REMINDER', 'GENERAL'];
const LABELS: Record<string,string> = { ANNOUNCEMENT:'Pengumuman', MUROTTAL:'Murottal Al-Quran', ADHAN:'Adzan', PRAYER_REMINDER:'Pengingat Sholat', GENERAL:'Lainnya' };

export function AudioLibraryPage() {
  const { user } = useAuth();
  const [mode,setMode] = useState<'upload'|'speech'>('upload');
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('');
  const [durations,setDurations] = useState<Record<string,string>>({});
  const [clock,setClock] = useState(new Date());
  const [timezone,setTimezone] = useState('Asia/Jakarta');
  useEffect(() => { api.get<{timezone:string}>('/mosque').then(m=>setTimezone(m.timezone)).catch(()=>{}); const timer=setInterval(()=>setClock(new Date()),1000); return()=>clearInterval(timer); },[]);
  const [items, setItems] = useState<Audio[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.get<Audio[]>('/audio').then(setItems).catch((err) => setError(err.message));
  useEffect(() => {
    load();
    const syncTimer = window.setInterval(load, 30_000);
    return () => window.clearInterval(syncTimer);
  }, []);

  const reset = () => {
    setEditingId(null); setName(''); setDescription(''); setCategory('GENERAL');
  };
  const edit = (audio: Audio) => {
    setMode('upload'); reset(); setEditingId(audio.id); setName(audio.name); setDescription(audio.description || '');
    setCategory(audio.category); setError(null); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    setMessage('');
    setUploading(true);
    try {
      if (editingId) {
        await api.patch(`/audio/${editingId}`, { name: name.trim(), category, description });
      }
      setMessage('Perubahan audio tersimpan.');
      reset(); await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (a: Audio) => { try { await api.patch(`/audio/${a.id}`, { isActive: !a.isActive }); await load(); } catch(err) { setError((err as Error).message); } };
  const remove = async (id: string) => { if (confirm('Hapus audio ini? File akan dihapus permanen.')) { try { await api.delete(`/audio/${id}`); await load(); } catch(err) { setError((err as Error).message); } } };
  const uploadAudio = async (file: File, onProgress: (progress: number) => void, signal: AbortSignal): Promise<S3UploadResult> => {
    if (signal.aborted) throw new DOMException('Upload dibatalkan.', 'AbortError');
    setError(null); setMessage(''); setUploading(true); onProgress(10);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name.trim() || file.name);
    formData.append('category', category);
    formData.append('description', description);
    try {
      const audio = await api.upload<Audio>('/audio/upload', formData, signal);
      onProgress(100);
      return { key: audio.id, file };
    } catch (error) {
      setError((error as Error).message);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleUploaded = async () => {
    setMessage('Audio berhasil diunggah.');
    reset();
    await load();
    setUploading(false);
  };
  const shown=items.filter(a=>(!filter||a.category===filter)&&[a.name,a.description].join(' ').toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="audio-library-page">
      <header><div><small>♫ AUDIO</small><h1>Audio Library</h1><p>Kelola koleksi audio untuk adzan, murottal, pengumuman, dan kegiatan mushola.</p></div><div className="audio-header-date"><b>{clock.toLocaleDateString('id-ID',{timeZone:timezone,weekday:'long',day:'numeric',month:'long',year:'numeric'})}</b><small>{clock.toLocaleDateString('id-ID-u-ca-islamic',{timeZone:timezone,day:'numeric',month:'long',year:'numeric'})}</small></div><strong className="audio-header-clock">{clock.toLocaleTimeString('id-ID',{timeZone:timezone,hourCycle:'h23'}).replaceAll('.',':')}</strong><div className="audio-header-user"><b>{user?.name}</b><small>● Sesi aktif</small></div></header>
      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success" role="status">{message}</div>}

      <div className="form-actions" style={{marginBottom:16}}><button type="button" className={mode==='upload'?'':'secondary'} aria-pressed={mode==='upload'} onClick={()=>setMode('upload')}>Upload File Audio</button><button type="button" className={mode==='speech'?'':'secondary'} aria-pressed={mode==='speech'} onClick={()=>setMode('speech')}>Buat Audio dari Teks</button></div>
      <div hidden={mode!=='speech'}><SpeechCreator onSaved={()=>void load()}/></div>
      <div hidden={mode!=='upload'}><div className="audio-upload-layout"><form className="form-panel form-inline" onSubmit={onSubmit}>
        <div className="audio-section-title"><span>↥</span><div><h2>{editingId ? 'Edit Audio' : 'Upload Audio Baru'}</h2><p>Tambahkan file audio ke library untuk digunakan pada jadwal pemutaran.</p></div></div>
        <label>Nama audio<input required={!!editingId} pattern={editingId ? '.*\\S.*' : undefined} placeholder="Nama audio" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Kategori audio<Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{LABELS[c]}</option>)}
        </Select></label>
        <label>Deskripsi<textarea value={description} onChange={e => setDescription(e.target.value)} /></label>
         {!editingId && <div className="audio-file-field"><label>File Audio (MP3 / WAV)</label><S3Upload accept=".mp3,.wav,audio/mpeg,audio/wav" maxSizeBytes={100 * 1024 * 1024} multiple={false} disabled={uploading} uploadFile={uploadAudio} onUploaded={() => { void handleUploaded(); }} /></div>}
        {editingId && <p className="hint">Ubah nama, kategori, dan deskripsi audio. File rekaman tetap menggunakan file yang sudah diunggah.</p>}
         <div className="form-actions">{editingId && <button type="submit" disabled={uploading}>{uploading ? 'Menyimpan...' : 'Simpan Perubahan'}</button>}
          <button type="button" className="secondary" disabled={uploading} onClick={() => { reset(); setError(null); }}>{editingId ? 'Batal' : '↶ Reset'}</button>
        </div>
      </form>
      <aside className="audio-info"><section><h2>▤ Informasi Format</h2><p>Format yang didukung: MP3, WAV<br/>Ukuran maksimal: 100 MB</p></section><section><h2>☷ Kategori Audio</h2>{CATEGORIES.map((c,i)=><p className="audio-category-guide" key={c}><span className={`audio-color-${i}`}>♫</span>{LABELS[c]}</p>)}</section></aside></div>
      </div><section className="form-panel audio-list-panel"><div className="audio-list-header"><div className="audio-section-title"><span>♫</span><div><h2>Daftar Audio Library</h2><p>Berikut koleksi audio yang tersedia di sistem.</p></div></div><div className="audio-list-filters"><input aria-label="Cari audio" placeholder="Cari audio..." value={query} onChange={e=>setQuery(e.target.value)}/><Select aria-label="Filter kategori audio" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Semua Kategori</option>{CATEGORIES.map(c=><option key={c} value={c}>{LABELS[c]}</option>)}</Select></div></div><div className="audio-table-scroll">
      <table className="data-table">
        <thead><tr><th>Nama Audio</th><th>Kategori</th><th>Durasi</th><th>Preview</th><th>Status</th><th>Tanggal Upload</th><th>Aksi</th></tr></thead>
        <tbody>
          {shown.map((a) => (
            <tr key={a.id}>
              <td><div className="audio-name"><span className={`audio-item-art audio-color-${CATEGORIES.indexOf(a.category)}`}>♫</span><div><b>{a.name}</b><small>{a.description || (a.fileSize ? `${(a.fileSize/1024/1024).toFixed(2)} MB` : '')}</small></div></div></td>
              <td><span className="audio-category-badge">{LABELS[a.category]||a.category}</span></td>
              <td>{durations[a.id] || '—'}</td>
              <td><audio controls preload="metadata" onPlay={e=>{const current=e.currentTarget;document.querySelectorAll('audio').forEach(audio=>{if(audio!==current)audio.pause();});}} onLoadedMetadata={e=>{const duration=e.currentTarget.duration;if(Number.isFinite(duration)){const n=Math.floor(duration);setDurations(prev=>({...prev,[a.id]:[Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(v=>String(v).padStart(2,'0')).join(':')}));}}} src={`${api.baseUrl}/audio/${a.id}/file`} style={{ height: 34 }} /></td>
              <td><button className="chip" onClick={() => toggleActive(a)}>{a.isActive ? 'Aktif' : 'Nonaktif'}</button></td>
              <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString('id-ID',{timeZone:timezone,day:'numeric',month:'short',year:'numeric'}) : '—'}<small className="audio-upload-time">{a.createdAt && new Date(a.createdAt).toLocaleTimeString('id-ID',{timeZone:timezone,hour:'2-digit',minute:'2-digit'})}</small></td>
              <td><div className="form-actions"><button className="secondary" disabled={uploading} onClick={() => edit(a)}>Edit</button><button className="danger" disabled={uploading || editingId === a.id} onClick={() => remove(a.id)}>Hapus</button></div></td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan={7}>{items.length ? 'Tidak ada audio yang sesuai pencarian.' : 'Belum ada audio.'}</td></tr>}
        </tbody>
      </table>
      </div></section>
    </div>
  );
}

