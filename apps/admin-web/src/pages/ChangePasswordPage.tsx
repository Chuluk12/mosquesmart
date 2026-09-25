import React, {useState} from 'react';
import {api} from '../lib/api';
import {useAuth} from '../contexts/AuthContext';

export function ChangePasswordPage() {
  const {user}=useAuth();
  const [currentPassword,setCurrent]=useState(''),[newPassword,setNew]=useState(''),[confirmPassword,setConfirm]=useState('');
  const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');setMessage('');
    if(newPassword!==confirmPassword){setError('Konfirmasi password baru tidak cocok.');return;}
    if(new TextEncoder().encode(newPassword).length>72){setError('Password baru maksimal 72 byte.');return;}
    setBusy(true);
    try{await api.post('/auth/change-password',{currentPassword,newPassword,confirmPassword});setCurrent('');setNew('');setConfirm('');setVisible(false);setMessage('Password berhasil diganti. Gunakan password baru saat login berikutnya.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div style={{maxWidth:760,margin:'0 auto',padding:'24px 0'}}><small>PENGATURAN AKUN</small><h1>Ganti Password</h1><p>Ubah password akun Anda: <strong>{user?.username}</strong>.</p>
    {error&&<p className="alert-error" role="alert">{error}</p>}{message&&<p className="alert-success" role="status">{message}</p>}
    <form className="form-panel" onSubmit={submit}>
      <input type="text" autoComplete="username" value={user?.username||''} readOnly hidden/>
      <fieldset disabled={busy} style={{border:0,padding:0,margin:0,display:'grid',gap:18}}>
        <label htmlFor="current-password">Password lama<input id="current-password" type={visible?'text':'password'} autoComplete="current-password" value={currentPassword} onChange={e=>setCurrent(e.target.value)} required maxLength={256}/></label>
        <label htmlFor="new-password">Password baru<input id="new-password" type={visible?'text':'password'} autoComplete="new-password" value={newPassword} onChange={e=>setNew(e.target.value)} required minLength={8} maxLength={72}/><small>Minimal 8 karakter.</small></label>
        <label htmlFor="confirm-password">Konfirmasi password baru<input id="confirm-password" type={visible?'text':'password'} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirm(e.target.value)} required minLength={8} maxLength={72}/></label>
        <button type="button" className="secondary" aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?'Sembunyikan password':'Tampilkan password'}</button>
        <button type="submit">{busy?'Menyimpan...':'Simpan Password Baru'}</button>
      </fieldset>
    </form>
  </div>;
}
