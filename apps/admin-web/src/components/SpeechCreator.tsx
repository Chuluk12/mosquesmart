import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Select } from './Select';

export function SpeechCreator({ onSaved }: { onSaved: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [serviceStatus, setServiceStatus] = useState('');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('id');
  const [speed, setSpeed] = useState('1');
  const [category, setCategory] = useState('ANNOUNCEMENT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<{ file: File; url: string; signature: string } | null>(null);
  const player = useRef<HTMLAudioElement>(null);
  const signature = JSON.stringify([text.trim(), voice, speed]);
  const stale = !!draft && draft.signature !== signature;
  const check = async () => {
    if (checking) return;
    setChecking(true); setConfigured(null); setServiceStatus('Sedang mengecek layanan suara...');
    try {
      const result = await api.get<{ configured: boolean }>('/audio/speech/status');
      setConfigured(result.configured);
      setServiceStatus(result.configured ? 'eSpeak NG siap digunakan. Isi teks lalu klik Buat Suara.' : 'Layanan suara belum tersedia pada server.');
    } catch (e) {
      setConfigured(null);
      setServiceStatus('Pengecekan gagal: ' + (e as Error).message);
    } finally { setChecking(false); }
  };
  useEffect(()=>{void check();},[]);
  useEffect(()=>()=>{if(draft) URL.revokeObjectURL(draft.url);},[draft]);
  async function generate(e: React.FormEvent) {
    e.preventDefault(); if(busy || !text.trim()) return;
    setBusy(true); setError(''); setMessage(''); player.current?.pause();
    try {
      const result = await api.post<{base64:string;mimeType:string}>('/audio/speech',{text:text.trim(),voice,speed:Number(speed)});
      const bytes = Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));
      const file = new File([bytes],'suara-dari-teks.wav',{type:result.mimeType});
      setDraft({file,url:URL.createObjectURL(file),signature});
      setMessage('Suara siap. Dengarkan preview, lalu simpan ke Audio Library.');
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save() {
    if(!draft || stale || busy) return;
    if(!name.trim()) { setError('Isi nama audio terlebih dahulu.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const form = new FormData(); form.append('file',draft.file); form.append('name',name.trim()); form.append('category',category);
      form.append('description',`Suara sintetis dari teks (${voice}): ${text.trim()}`);
      await api.upload('/audio/upload',form); player.current?.pause(); setDraft(null);
      setMessage('Audio tersimpan. Pilih nama audio ini di menu Jadwal Audio.'); onSaved();
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="form-panel"><h2>Buat Audio dari Teks</h2><p>Tulis pengumuman bahasa Indonesia, buat suara, lalu simpan untuk dijadwalkan.</p>
    {serviceStatus&&<p role="status" aria-live="polite" className={checking?'hint':configured?'alert-success':'alert-error'}>{serviceStatus}</p>}
    {configured===false&&<div className="alert-error">eSpeak NG belum tersedia pada server. Pasang eSpeak NG atau atur ESPEAK_PATH pada API, lalu klik Cek Layanan.</div>}
    {error&&<p className="alert-error" role="alert">{error}</p>}{message&&<p className="alert-success" role="status">{message}</p>}
    <form onSubmit={generate}><fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
      <div className="form-row"><label>Nama audio<input value={name} maxLength={150} onChange={e=>setName(e.target.value)} placeholder="Pengumuman kajian Jumat"/></label>
      <label>Kategori<Select value={category} onChange={e=>setCategory(e.target.value)}><option value="ANNOUNCEMENT">Pengumuman</option><option value="PRAYER_REMINDER">Pengingat Sholat</option><option value="GENERAL">Lainnya</option></Select></label></div>
      <label>Teks yang dibacakan<textarea required rows={5} maxLength={3000} value={text} onChange={e=>setText(e.target.value)} placeholder="Assalamu'alaikum. Kepada seluruh karyawan, kajian akan segera dimulai. Silakan menuju mushola."/></label><p className="hint">{text.length}/3000 karakter. Periksa pelafalan nama dan istilah sebelum menyimpan.</p>
      <div className="form-row"><label>Suara<Select value={voice} onChange={e=>setVoice(e.target.value)}><option value="id">Indonesia - Standar</option><option value="id+f3">Indonesia - Nada lebih tinggi</option></Select></label>
      <label>Kecepatan<Select value={speed} onChange={e=>setSpeed(e.target.value)}><option value="0.85">Lebih pelan</option><option value="1">Normal</option><option value="1.15">Lebih cepat</option></Select></label></div>
      <p className="hint">Suara sintetis dibuat di server menggunakan eSpeak NG, tanpa API key atau biaya layanan suara. Karakter suaranya lebih robotik. Mengubah teks atau suara memerlukan pembuatan ulang.</p>
      <div className="form-actions"><button disabled={!configured||!text.trim()||busy||checking} type="submit">{busy?'Memproses...':draft?'Buat Ulang Suara':'Buat Suara'}</button><button type="button" className="secondary" disabled={checking} onClick={()=>void check()}>{checking?'Sedang mengecek...':'Cek Layanan'}</button></div>
    </fieldset></form>
    {draft&&<div style={{marginTop:16}}><h3>Preview Suara</h3><audio ref={player} src={draft.url} controls style={{width:'100%'}}/>{stale&&<p role="status">Teks atau suara berubah. Klik Buat Ulang Suara sebelum menyimpan.</p>}<button type="button" disabled={busy||stale} onClick={()=>void save()}>Simpan ke Audio Library</button></div>}
  </section>;
}