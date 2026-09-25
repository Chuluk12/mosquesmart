import React, {useEffect, useState} from 'react';
import {api} from '../lib/api';

const backgrounds = [
  {id:'default', name:'Bawaan Layout', image:'/dashboard-mosque.png', description:'Gambar masjid bawaan untuk semua layout dan warna tema.'},
  {id:'kaaba', name:"Ka'bah · Makkah", image:'/backgrounds/kaaba.png', description:'Ilustrasi Ka’bah dengan langit senja biru.'},
  {id:'madinah', name:'Nuansa Madinah', image:'/backgrounds/madinah.png', description:'Ilustrasi kubah hijau dan menara bernuansa tenang.'},
  {id:'ottoman', name:'Masjid Ottoman', image:'/backgrounds/ottoman.png', description:'Ilustrasi kubah bertingkat di tepi perairan saat senja.'},
];
export function DisplayBackgroundPicker(){
  const [active,setActive]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState('');
  useEffect(()=>{api.get<{displayBackground?:string}>('/mosque').then(m=>setActive(m.displayBackground||'default')).catch(e=>setError(e.message));},[]);
  async function apply(id:string){setBusy(true);setError('');setMessage('');try{await api.put('/mosque',{displayBackground:id});setActive(id);setMessage('Gambar latar tersimpan. Display memperbarui secara otomatis.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="background-picker"><h2>Gambar Latar Display</h2><p>Pilih gambar secara terpisah dari layout dan warna. Ketiga latar baru adalah ilustrasi artistik, bukan foto dokumentasi.</p>{error&&<p role="alert" className="alert-error">{error}</p>}{message&&<p role="status" className="alert-success">{message}</p>}<div className="background-choices">{backgrounds.map(b=><article key={b.id} className={active===b.id?'selected':''}><img src={b.image} alt={b.description}/><div><h3>{b.name} {active===b.id&&<small>Aktif</small>}</h3><p>{b.description}</p><button disabled={busy||!active||active===b.id} onClick={()=>apply(b.id)}>{active===b.id?'Sedang Digunakan':busy?'Menyimpan...':'Gunakan Gambar'}</button></div></article>)}</div></section>;
}
