import React from 'react';
import './prayer-alarm.css';
export function PrayerAlarm({name,logo,heading,prayer,time,countdown}:{name:string;logo?:string;heading:string;prayer:string;time:string;countdown?:string}) {
 return <main className="prayer-alarm">
  <header className="alarm-brand"><img src={logo||'/mosque-logo.svg'} alt=""/><h1>{name}</h1><p>Rumah Allah, Rumah Kita</p></header>
  <aside className="alarm-faith"><b lang="ar">الله</b><span>LEBIH<br/>DEKAT<br/>DENGAN<br/>ALLAH</span></aside>
  <div className="alarm-ornament" aria-hidden="true"><i/><span>۞</span><i/></div>
  <section className="alarm-frame" aria-label={`${heading} ${prayer}`}>
   <svg className="alarm-outline" viewBox="0 0 800 570" preserveAspectRatio="none" aria-hidden="true"><path d="M400 5C325 62 184 15 139 115H99C43 115 10 156 10 212V448C10 502 40 534 101 534H110Q122 564 159 564H641Q678 564 690 534H699C760 534 790 502 790 448V212C790 156 757 115 701 115H661C616 15 475 62 400 5Z"/></svg>
   <div className="alarm-content"><svg className="alarm-speaker" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path fill="currentColor" d="M7 25h12L35 13v38L19 39H7Z"/><path d="M43 23q10 9 0 18M50 15q17 17 0 34"/></svg><p>{heading}</p><h2>{prayer}</h2><div className="alarm-glow"/><strong className={countdown?'alarm-countdown':''}>{countdown||time}</strong>{countdown&&<small>MENUJU IQAMAH</small>}<div className="alarm-bottom-ornament" aria-hidden="true">──── ◇ ────</div></div>
  </section>
 </main>;
}
