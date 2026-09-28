import {useLocation} from 'react-router-dom';
import {runtimeConfig} from '../lib/runtime-config';
import React,{useEffect,useRef,useState} from 'react';
import {io,Socket} from 'socket.io-client';
import {api} from '../lib/api';

export function BrowserPlayer(){
 const location=useLocation();
 const [state,setState]=useState('Belum aktif'),[enabled,setEnabled]=useState(false),[error,setError]=useState('');
 const audio=useRef<HTMLAudioElement>(null),socket=useRef<Socket|null>(null),history=useRef<string|null>(null),limit=useRef<number|null>(null),generation=useRef(0),activating=useRef(false);
 const [deviceId]=useState(()=>`browser-${crypto.randomUUID()}`);
 function report(status:string,message?:string){socket.current?.emit('player:status',{deviceId,historyId:history.current??undefined,status,errorMessage:message});if(['FINISHED','STOPPED','ERROR'].includes(status)){history.current=null;limit.current=null;}}
 function stop(){generation.current++;const a=audio.current;if(a){a.pause();a.removeAttribute('src');a.load();}if(history.current)report('STOPPED');}
 function deactivate(){stop();socket.current?.disconnect();socket.current=null;setEnabled(false);setState('Belum aktif');}
 async function activate(){
  if(activating.current||socket.current)return;activating.current=true;setError('');
  try{
   // A user gesture unlocks this same media element for subsequent remote commands.
   const a=audio.current!;
   a.src='data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==';
   await a.play();a.pause();a.removeAttribute('src');a.load();
   const base=runtimeConfig.socketUrl||new URL(api.baseUrl,window.location.origin).origin;
   const s=io(`${base.replace(/\/$/,'')}/player`,{autoConnect:false,reconnection:true});socket.current=s;
   s.on('connect',()=>{setState('Mendaftarkan perangkat...');s.emit('player:register',{deviceId,name:'Player Browser'});});
   s.on('player:registered',(ack:{ok:boolean;error?:string})=>{setState(ack.ok?'Online - siap memutar audio':'Gagal mendaftar');if(!ack.ok)setError(ack.error||'Pendaftaran gagal.');});
   s.on('disconnect',()=>setState('Terputus - mencoba tersambung kembali'));
   s.on('connect_error',()=>{setState('Koneksi gagal');setError('Tidak dapat terhubung ke server player. Periksa konfigurasi Socket.IO hosting.');});
   s.on('audio:play',async(p:{historyId:string;audioId:string;volume:number;maxDurationMinutes?:number|null})=>{
    stop();const version=generation.current;history.current=p.historyId;limit.current=p.maxDurationMinutes&&p.maxDurationMinutes>0?p.maxDurationMinutes*60:null;
    a.volume=Math.max(0,Math.min(1,(p.volume??80)/100));
    // Use the same public API origin as this admin, never server-side localhost URLs.
    a.src=`${api.baseUrl}/audio/${encodeURIComponent(p.audioId)}/file`;report('LOADING');setState('Memuat audio...');
    try{await a.play();if(version!==generation.current)return;setError('');}catch(e){if(version!==generation.current)return;report('ERROR',(e as Error).message);setState('Gagal memutar');setError('Audio gagal diputar. Periksa file audio dan izin suara browser. Nonaktifkan lalu aktifkan kembali jika diblokir browser.');}
   });
   s.on('audio:stop',()=>{stop();setState('Online - audio dihentikan');});
   s.on('audio:pause',()=>{a.pause();setState('Audio dijeda');});
   s.on('audio:resume',()=>{void a.play().catch(e=>{report('ERROR',e.message);setError('Browser menolak melanjutkan audio.');});});
   s.on('audio:set-volume',(p:{volume:number})=>{a.volume=Math.max(0,Math.min(1,p.volume/100));});
   setEnabled(true);setState('Menghubungkan...');s.connect();
  }catch(e){setError('Izin audio belum aktif: '+(e as Error).message);}finally{activating.current=false;}
 }
 useEffect(()=>{const timer=setInterval(()=>{if(socket.current?.connected)socket.current.emit('player:heartbeat',{deviceId});},10000);const budget=setInterval(()=>{if(history.current&&limit.current&&audio.current&&audio.current.currentTime>=limit.current){stop();setState('Online - batas durasi tercapai');}},250);return()=>{clearInterval(timer);clearInterval(budget);stop();socket.current?.disconnect();};},[]);
 return <section className="form-panel" hidden={!enabled && location.pathname!=='/players'}><h2>Player Browser</h2><p>Putar audio jadwal dari hosting melalui speaker perangkat ini.</p><p role="status"><strong>{state}</strong></p>{error&&<p className="alert-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" disabled={enabled} onClick={()=>void activate()}>Aktifkan Audio Browser</button><button type="button" className="secondary" disabled={!enabled} onClick={deactivate}>Nonaktifkan</button></div><p className="hint">Player tetap aktif saat berpindah menu di tab ini. Jangan tutup atau refresh tab dan pastikan perangkat tidak sleep. Setelah refresh, klik Aktifkan Audio Browser kembali. Aktifkan hanya satu tab pada perangkat speaker agar suara tidak berlipat. Setelah Online, pilih audio dan klik Play di Player untuk tes.</p><audio ref={audio} preload="auto" onPlaying={()=>{if(history.current){report('PLAYING');setState('Sedang memutar audio');}}} onEnded={()=>{if(history.current){report('FINISHED');setState('Online - audio selesai');}}} onError={()=>{if(history.current){report('ERROR','File audio tidak dapat dimuat');setError('File audio tidak dapat dimuat dari hosting.');setState('Gagal memuat audio');}}}/></section>;
}

