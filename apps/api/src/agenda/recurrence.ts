import {addDays, zonedTimeToUtc} from '../prayer/utils/time.util';
function local(d:Date, zone:string) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
export function resolveAgenda<T extends {startDate:Date;endDate:Date|null;repeatWeekly:boolean}>(agenda:T, zone:string, now=new Date()):T {
  if(!agenda.repeatWeekly) return agenda;
  const anchor=local(agenda.startDate,zone), today=local(now,zone);
  const weeks=Math.max(0,Math.floor((Date.parse(today.date)-Date.parse(anchor.date))/604800000));
  const end=agenda.endDate?local(agenda.endDate,zone):null;
  for(let week=weeks;week<=weeks+1;week++) {
    const startDate=zonedTimeToUtc(addDays(anchor.date,week*7),anchor.time,zone);
    const endDate=end?zonedTimeToUtc(addDays(end.date,week*7),end.time,zone):null;
    if((endDate||startDate).getTime()>now.getTime()) return {...agenda,startDate,endDate};
  }
  return agenda;
}
