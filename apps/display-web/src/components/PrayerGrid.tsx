import React from 'react';
import { PrayerKey } from '@mosque/shared-types';
const PRAYERS: { key: PrayerKey; label: string }[] = [
  { key:'fajr',label:'SUBUH' }, { key:'dhuhr',label:'DZUHUR' }, { key:'asr',label:'ASHAR' }, { key:'maghrib',label:'MAGHRIB' }, { key:'isha',label:'ISYA' },
];
function PrayerIcon({name}:{name:PrayerKey}){if(name==='dhuhr')return <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="12"/><path d="M32 4v10M32 50v10M4 32h10M50 32h10M12 12l7 7M45 45l7 7M52 12l-7 7M19 45l-7 7"/></svg>;if(name==='asr')return <svg viewBox="0 0 64 64"><path d="M18 47h30a10 10 0 0 0 1-20 16 16 0 0 0-30-3 12 12 0 0 0-1 23Z"/></svg>;if(name==='isha')return <svg viewBox="0 0 64 64"><path d="M45 49A23 23 0 0 1 34 6a23 23 0 1 0 11 43Z"/></svg>;return <svg viewBox="0 0 64 64"><path d="M10 43h44M17 35a15 15 0 0 1 30 0M32 10v8M12 22l6 5M52 22l-6 5M18 51h28"/></svg>}
function twelve(time:string){const[h,m]=time.split(':').map(Number);return{time:`${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')}`,period:h<12?'AM':'PM'};}
export function PrayerGrid({effective,active}:{effective:Record<PrayerKey,string>;active:PrayerKey|null}){return <section className="prayers">{PRAYERS.map(({key,label})=>{const d=twelve(effective[key]);return <article key={key} className={`prayer-card prayer-${key}${active===key?' active':''}`}><span className="prayer-icon"><PrayerIcon name={key}/></span><small>{label}</small><b>{d.time}</b><span className="period">{d.period}</span></article>;})}</section>}
