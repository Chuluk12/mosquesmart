import React, { useEffect, useState } from 'react';
import { Agenda, Content, PrayerToday } from '../hooks/useMosqueData';
import { runtimeConfig } from '../lib/runtime-config';
import './agenda-slides.css';

function MetaIcon({kind}:{kind:'calendar'|'clock'|'pin'}) {
 return <svg className="study-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='calendar'?<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18M7 15h1m4 0h1m4 0h1M7 18h1m4 0h1"/></>:kind==='clock'?<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>:<><path fill="currentColor" stroke="none" d="M12 2a8 8 0 0 0-8 8c0 6 8 13 8 13s8-7 8-13a8 8 0 0 0-8-8Z"/><circle cx="12" cy="10" r="3" fill="white" stroke="none"/></>}</svg>;
}

const mediaSource=(url?:string)=>url?.startsWith('/api/contents/images/')?new URL(url,new URL(runtimeConfig.apiUrl||'/api',window.location.origin)).href:url;

// Use the persisted durations; prayer takeover screens unmount this slideshow.
export function AgendaSlides({ contents = [], agendas, timezone, mosqueName, prayer, enabled, prayerSeconds = 120, agendaSeconds = 60 }: { contents?: Content[]; agendas: Agenda[]; timezone: string; mosqueName?: string; prayer: PrayerToday; enabled: boolean; prayerSeconds?: number; agendaSeconds?: number }) {
  const [slide, setSlide] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const day = (value: number) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
  const available = (enabled ? agendas : []).filter(a => a.endDate ? Date.parse(a.endDate) > now : day(Date.parse(a.startDate)) >= day(now))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const media = contents.filter(c => c.isActive !== false && c.type !== 'RUNNING_TEXT' && (!c.startAt || Date.parse(c.startAt)<=now) && (!c.endAt || Date.parse(c.endAt)>now) && (['IMAGE','VIDEO'].includes(c.type) ? !!c.mediaUrl : !!c.content)).sort((a,b)=>(a.displayOrder||0)-(b.displayOrder||0)||a.id.localeCompare(b.id));
  const total = available.length + media.length;
  const content = media[slide - available.length - 1];
  const seconds = slide===0 ? prayerSeconds : content ? Math.max(1, Math.min(3600, content.durationSeconds||10)) : agendaSeconds;
  const identity = JSON.stringify([available.map(a=>a.id),media.map(c=>[c.id,c.durationSeconds,c.mediaUrl,c.content,c.title])]);
  useEffect(() => { setSlide(0); }, [identity, enabled, prayerSeconds, agendaSeconds]);
  useEffect(() => {
    if (!total) return;
    const timer = setTimeout(() => setSlide(value => (value + 1) % (total + 1)), seconds * 1000);
    return () => clearTimeout(timer);
  }, [slide, identity, total, seconds]);
  const agenda = available[slide - 1];
  if (content) return <section className="agenda-display-slide content-display-slide" key={content.id} aria-label={content.title||'Konten display'}>
    {content.type==='IMAGE'?<img src={mediaSource(content.mediaUrl)} alt={content.title||'Poster'} onError={()=>setSlide(value=>(value+1)%(total+1))}/>:content.type==='VIDEO'?<video src={mediaSource(content.mediaUrl)} autoPlay muted playsInline loop onError={()=>setSlide(value=>(value+1)%(total+1))}/>:<article><h2>{content.title}</h2><p>{content.content}</p></article>}
    <div className="agenda-slide-progress" style={{animationDuration:`${seconds}s`}}/>
  </section>;
  if (!agenda || slide === 0) return null;
  const time=(d:string)=>new Date(d).toLocaleTimeString('id-ID',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  return <section className="agenda-display-slide study-slide" key={agenda.id} aria-label="Agenda mushola">
     <div className="study-art">{agenda.hasImage&&<img className="study-custom-image" src={`${runtimeConfig.apiUrl||'/api'}/agendas/${agenda.id}/image?v=${agenda.updatedAt||''}`} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>}<span className="study-badge">&#128214; &nbsp; {agenda.repeatWeekly?'KAJIAN RUTIN':'AGENDA MUSHOLA'}</span><blockquote>&ldquo;{agenda.quote||'Mari belajar bersama, menambah ilmu dan mempererat ukhuwah.'}&rdquo;</blockquote></div>
    <div className="study-body"><small className="study-eyebrow">AGENDA MUSHOLA</small><h2>{agenda.title}</h2>
      {agenda.topic&&<h3>{agenda.topic}</h3>}
      {agenda.description&&<p className="study-description">{agenda.description}</p>}
      {agenda.speakerName&&<div className="study-speaker"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="32" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg></span><div><small>BERSAMA</small><strong>{agenda.speakerName}</strong>{agenda.speakerRole&&<p>{agenda.speakerRole}</p>}</div></div>}
      <div className="study-meta">
        <div><MetaIcon kind="calendar"/><div className="study-meta-text"><small>HARI &amp; TANGGAL</small><strong>{new Date(agenda.startDate).toLocaleDateString('id-ID',{timeZone:timezone,weekday:'long',day:'numeric',month:'long',year:'numeric'})}</strong><span>{new Date(agenda.startDate).toLocaleDateString('id-ID-u-ca-islamic',{timeZone:timezone,day:'numeric',month:'long',year:'numeric'})}</span></div></div>
        <div><MetaIcon kind="clock"/><div className="study-meta-text"><small>WAKTU</small><strong>{time(agenda.startDate)}{agenda.endDate&&` \u2013 ${time(agenda.endDate)}`}</strong><span>({timezone})</span></div></div>
        <div><MetaIcon kind="pin"/><div className="study-meta-text"><small>TEMPAT</small><strong>{mosqueName||agenda.location||'Di mushola'}</strong>{mosqueName&&agenda.location&&agenda.location!==mosqueName&&<span>{agenda.location}</span>}</div></div>
      </div>
      <div className="study-invitation"><strong>{agenda.audience||'Mari hadiri kegiatan mushola'}</strong><p>{agenda.invitation||'Mari hadir tepat waktu dan belajar bersama.'}</p></div>
      <div className="study-prayer-times" aria-label="Jadwal sholat hari ini">{Object.entries(prayer.effective).map(([key,t])=><div key={key} className={prayer.nextPrayer?.name===key?'selected':''}><span>{{fajr:'Subuh',dhuhr:'Dzuhur',asr:'Ashar',maghrib:'Maghrib',isha:'Isya'}[key]||key}</span><strong>{t}</strong></div>)}</div>
      <footer className="study-footer"><span>{slide} / {available.length}</span><button type="button" aria-label="Agenda sebelumnya" onClick={()=>setSlide(slide<=1?available.length:slide-1)}>&lsaquo;</button><button type="button" aria-label="Agenda berikutnya" onClick={()=>setSlide(slide>=total?0:slide+1)}>&rsaquo;</button></footer>
    </div><div className="agenda-slide-progress" style={{animationDuration:`${agendaSeconds}s`}}/>
  </section>;
}
