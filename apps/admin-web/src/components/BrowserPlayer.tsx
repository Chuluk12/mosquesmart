import {useLocation} from 'react-router-dom';
import {runtimeConfig} from '../lib/runtime-config';
import React,{useEffect,useRef,useState} from 'react';
import {io,Socket} from 'socket.io-client';
import {api} from '../lib/api';

interface PublicAudio { id: string; name: string }

export function BrowserPlayer(){
 const location=useLocation();
 const publicMode=location.pathname==='/audio-schedule-public';
 const [state,setState]=useState('Belum aktif'),[enabled,setEnabled]=useState(false),[error,setError]=useState(''),[audios,setAudios]=useState<PublicAudio[]>([]),[testAudioId,setTestAudioId]=useState('');
 const audio=useRef<HTMLAudioElement>(null),socket=useRef<Socket|null>(null),history=useRef<string|null>(null),limit=useRef<number|null>(null),generation=useRef(0),activating=useRef(false),startPosition=useRef(0),repeatRemaining=useRef(1),repeatTotal=useRef(1),repeatElapsed=useRef(0),sequenceRef=useRef<{historyId:string;audioId:string}[]>([]),sequenceIndex=useRef(0);
 const [deviceId]=useState(()=>`browser-${crypto.randomUUID()}`);
 function report(status:string,message?:string){socket.current?.emit('player:status',{deviceId,historyId:history.current??undefined,status,errorMessage:message,positionSeconds:audio.current?.currentTime});if(['FINISHED','STOPPED','ERROR'].includes(status)){history.current=null;limit.current=null;}}
 function stop(){generation.current++;const pending=[...new Set(sequenceRef.current.slice(sequenceIndex.current+1).map(track=>track.historyId))];const current=history.current;const a=audio.current;if(a){a.pause();if(history.current)report(a.ended?'FINISHED':'STOPPED');a.onloadedmetadata=null;a.removeAttribute('src');a.load();}pending.filter(id=>id!==current).forEach(historyId=>socket.current?.emit('player:status',{deviceId,historyId,status:'STOPPED'}));sequenceRef.current=[];sequenceIndex.current=0;repeatRemaining.current=1;repeatElapsed.current=0;setState(socket.current?.connected?'Online - audio dihentikan':'Belum aktif');}
 function deactivate(){stop();socket.current?.disconnect();socket.current=null;setEnabled(false);setState('Belum aktif');}
 async function playTest(){
  if(!enabled||!testAudioId||history.current)return;
  const a=audio.current;if(!a)return;
  setError('');stop();
  a.volume=0.8;
  a.src=`${api.baseUrl}/audio/${encodeURIComponent(testAudioId)}/file`;
  try{await a.play();setState('Memutar audio tes');}
  catch(e){setError('Audio tes gagal diputar. Periksa izin suara browser. '+(e as Error).message);setState('Gagal memutar');}
 }
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
   s.on('audio:play',async(p:{historyId:string;audioId:string;volume:number;maxDurationMinutes?:number|null;startPositionSeconds?:number;repeatCount?:number})=>{
    stop();sequenceRef.current=[];sequenceIndex.current=0;const version=generation.current;history.current=p.historyId;startPosition.current=Math.max(0,p.startPositionSeconds||0);repeatRemaining.current=Math.max(1,Math.floor(p.repeatCount||1));repeatTotal.current=repeatRemaining.current;repeatElapsed.current=0;limit.current=p.maxDurationMinutes&&p.maxDurationMinutes>0?p.maxDurationMinutes*60:null;
    a.volume=Math.max(0,Math.min(1,(p.volume??80)/100));
    // Use the same public API origin as this admin, never server-side localhost URLs.
    a.src=`${api.baseUrl}/audio/${encodeURIComponent(p.audioId)}/file`;report('LOADING');setState('Memuat audio...');
    a.onloadedmetadata=()=>{
     if(version!==generation.current)return;
     if(startPosition.current>0){
      if(Number.isFinite(a.duration)&&startPosition.current>=a.duration){report('FINISHED');a.pause();return;}
      a.currentTime=startPosition.current;
     }
    };
    try{await a.play();if(version!==generation.current)return;setError('');}catch(e){if(version!==generation.current)return;report('ERROR',(e as Error).message);setState('Gagal memutar');setError('Audio gagal diputar. Periksa file audio dan izin suara browser. Nonaktifkan lalu aktifkan kembali jika diblokir browser.');}
   });
   s.on('audio:play-sequence',async(p:{tracks:{historyId:string;audioId:string}[];volume:number;maxDurationMinutes?:number|null;repeatCount?:number})=>{
    stop();if(!p.tracks.length)return;
    const repeats=Math.max(1,Math.floor(p.repeatCount||1));
    sequenceRef.current=Array.from({length:repeats},()=>p.tracks).flat();sequenceIndex.current=0;
    const first=sequenceRef.current[0];history.current=first.historyId;startPosition.current=0;repeatElapsed.current=0;repeatRemaining.current=1;limit.current=p.maxDurationMinutes&&p.maxDurationMinutes>0?p.maxDurationMinutes*60:null;
    a.volume=Math.max(0,Math.min(1,(p.volume??80)/100));a.src=`${api.baseUrl}/audio/${encodeURIComponent(first.audioId)}/file`;report('LOADING');setState('Memuat audio 1 dari '+sequenceRef.current.length+'...');
    try{await a.play();setError('');}catch(e){report('ERROR',(e as Error).message);sequenceRef.current=[];setState('Gagal memutar');setError('Audio gagal diputar. Periksa izin suara browser.');}
   });

   s.on('audio:stop',()=>{stop();setState('Online - audio dihentikan');});
   s.on('audio:pause',()=>{a.pause();setState('Audio dijeda');});
   s.on('audio:resume',()=>{void a.play().catch(e=>{report('ERROR',e.message);setError('Browser menolak melanjutkan audio.');});});
   s.on('audio:set-volume',(p:{volume:number})=>{a.volume=Math.max(0,Math.min(1,p.volume/100));});
   setEnabled(true);setState('Menghubungkan...');s.connect();
  }catch(e){setError('Izin audio belum aktif: '+(e as Error).message);}finally{activating.current=false;}
 }
 useEffect(()=>{
  if(publicMode)api.get<PublicAudio[]>('/public/audio-schedules/audios').then(rows=>{setAudios(rows);setTestAudioId(rows[0]?.id||'');}).catch(e=>setError((e as Error).message));
  const timer=setInterval(()=>{if(socket.current?.connected){socket.current.emit('player:heartbeat',{deviceId});if(history.current&&audio.current)socket.current.emit('player:progress',{deviceId,historyId:history.current,positionSeconds:audio.current.currentTime});}},10000);
  const budget=setInterval(()=>{if(history.current&&limit.current&&audio.current&&repeatElapsed.current+Math.max(0,audio.current.currentTime-startPosition.current)>=limit.current){stop();setState('Online - batas durasi tercapai');}},250);
  return()=>{clearInterval(timer);clearInterval(budget);stop();socket.current?.disconnect();};
 },[]);
 return <section className="form-panel" hidden={!enabled&&location.pathname!=='/players'&&!publicMode}><h2>Player Browser</h2><p>Putar audio terjadwal dari halaman publik ini melalui speaker perangkat.</p><p role="status"><strong>{state}</strong></p>{error&&<p className="alert-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" disabled={enabled} onClick={()=>void activate()}>Aktifkan Audio Browser</button><button type="button" className="secondary" disabled={!enabled} onClick={deactivate}>Nonaktifkan</button></div>{publicMode&&<div className="public-audio-test"><label htmlFor="public-audio-test-select">Tes suara speaker</label><div><select id="public-audio-test-select" value={testAudioId} onChange={e=>setTestAudioId(e.target.value)} disabled={!enabled||!!history.current}><option value="">Pilih audio...</option>{audios.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" disabled={!enabled||!testAudioId||!!history.current} onClick={()=>void playTest()}>Putar Tes</button><button type="button" className="secondary" disabled={!enabled} onClick={stop}>Stop</button></div></div>}<p className="hint">Aktifkan player satu kali pada laptop speaker. Setelah status Online, jadwal akan diputar otomatis; tab harus tetap terbuka dan perangkat tidak boleh sleep. Putar Tes hanya untuk memeriksa suara di perangkat ini.</p><audio ref={audio} preload="auto" onPlaying={()=>{if(history.current){report('PLAYING');setState('Memutar audio ('+(repeatTotal.current-repeatRemaining.current+1)+'/'+repeatTotal.current+')');}else if(publicMode)setState('Memutar audio tes');}} onEnded={()=>{const a=audio.current;if(sequenceRef.current.length&&a){
  repeatElapsed.current+=Math.max(0,a.currentTime);
  if(limit.current&&repeatElapsed.current>=limit.current){sequenceRef.current=[];report('STOPPED');setState('Online - batas durasi tercapai');return;}
  const old=sequenceRef.current[sequenceIndex.current],next=sequenceRef.current[sequenceIndex.current+1];
  if(next){
   if(next.historyId!==old.historyId)socket.current?.emit('player:status',{deviceId,historyId:old.historyId,status:'FINISHED',positionSeconds:a.currentTime});
   sequenceIndex.current++;history.current=next.historyId;startPosition.current=0;a.src=`${api.baseUrl}/audio/${encodeURIComponent(next.audioId)}/file`;report('LOADING');setState('Memutar audio '+(sequenceIndex.current+1)+' dari '+sequenceRef.current.length);
   void a.play().catch(e=>{report('ERROR',(e as Error).message);sequenceRef.current=[];setError('Audio gagal dilanjutkan.');});return;
  }
  sequenceRef.current=[];sequenceIndex.current=0;report('FINISHED');setState('Online - urutan audio selesai');return;
}if(history.current&&a){repeatElapsed.current+=Math.max(0,a.currentTime-startPosition.current);if(limit.current&&repeatElapsed.current>=limit.current){report('STOPPED');setState('Online - batas durasi tercapai');return;}if(repeatRemaining.current>1){repeatRemaining.current--;startPosition.current=0;a.currentTime=0;setState('Mengulang audio ('+(repeatTotal.current-repeatRemaining.current+1)+'/'+repeatTotal.current+')');void a.play().catch(e=>{report('ERROR',(e as Error).message);setError('Audio gagal diulang.');});return;}report('FINISHED');setState('Online - audio selesai');}else if(publicMode)setState('Online - audio tes selesai');}} onError={()=>{if(history.current){report('ERROR','File audio tidak dapat dimuat');setError('File audio tidak dapat dimuat dari hosting.');setState('Gagal memuat audio');}}}/></section>;
}