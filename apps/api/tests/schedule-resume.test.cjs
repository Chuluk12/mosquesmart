require('reflect-metadata');
require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env'),quiet:true});
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {PlayerService}=require('../dist/player/player.service');
const {AudioScheduleService}=require('../dist/audio-schedule/audio-schedule.service');
const db=new PrismaClient(),tag='resume-test-'+randomUUID(),audioIds=[],scheduleIds=[];
(async()=>{
 assert.ok(['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname));
 const mosque=await db.mosque.findFirst(), m={getOrCreate:async()=>mosque}, sent=[];
 const p=new PlayerService(db,m,{findOne:id=>db.audio.findUniqueOrThrow({where:{id}}),publicUrl:()=>'/fake'}, {emit(){}});
 p.bindServer({to:()=>({emit:(event,payload)=>{if(event==='audio:play')sent.push(payload)}})});
 await p.registerConnection(tag,tag,tag);
 await p.registerConnection(tag+'-2',tag,tag+'-2');
 for(let i=0;i<2;i++) audioIds.push((await db.audio.create({data:{mosqueId:mosque.id,name:tag,category:'GENERAL',filePath:tag}})).id);
 const svc=new AudioScheduleService(db,{},m);
 const a=await svc.create({audioId:audioIds[0],scheduleType:'FIXED_TIME',fixedTime:'08:00',resumePlayback:true,maxDurationMinutes:60,isActive:false});scheduleIds.push(a.id);
 const b=await svc.create({audioId:audioIds[0],scheduleType:'FIXED_TIME',fixedTime:'09:00',resumePlayback:true,isActive:false});scheduleIds.push(b.id);
 let result=await p.playOnAllOnline(audioIds[0],80,'SCHEDULE',a.id,60);assert.equal(result.targeted,1);
 let first=sent.at(-1);assert.equal(first.startPositionSeconds,0);
 await p.saveSchedulePosition(tag,first.historyId,3590);
 await p.reportStatus(tag,first.historyId,'STOPPED',undefined,3600);
 assert.equal((await db.audioSchedule.findUnique({where:{id:a.id}})).resumePositionSeconds,3600);
 await p.play(tag,audioIds[0],80,'SCHEDULE',a.id,undefined,60);
 let second=sent.at(-1);assert.equal(second.startPositionSeconds,3600);assert.equal(second.maxDurationMinutes,60);
 await p.saveSchedulePosition(tag,first.historyId,4000); // obsolete run
 await p.saveSchedulePosition(tag+'-2',second.historyId,5000); // different device
 await p.saveSchedulePosition(tag,second.historyId,NaN);
 assert.equal((await db.audioSchedule.findUnique({where:{id:a.id}})).resumePositionSeconds,3600);
 await p.saveSchedulePosition(tag,second.historyId,5000);
 await p.saveSchedulePosition(tag,second.historyId,4900); // out-of-order heartbeat
 assert.equal((await db.audioSchedule.findUnique({where:{id:a.id}})).resumePositionSeconds,5000);
 await p.reportStatus(tag,second.historyId,'FINISHED',undefined,7200);
 await p.saveSchedulePosition(tag,second.historyId,7100); // delayed after end
 await p.play(tag,audioIds[0],80,'SCHEDULE',a.id,undefined,60);
 let third=sent.at(-1);assert.equal(third.startPositionSeconds,0);
 assert.equal((await db.audioSchedule.findUnique({where:{id:b.id}})).resumePositionSeconds,0);
 await p.saveSchedulePosition(tag,third.historyId,60);
 await svc.update(a.id,{volume:90});
 assert.equal((await db.audioSchedule.findUnique({where:{id:a.id}})).resumePositionSeconds,60);
 await svc.update(a.id,{audioId:audioIds[1]});
 await p.saveSchedulePosition(tag,third.historyId,100);
 assert.equal((await db.audioSchedule.findUnique({where:{id:a.id}})).resumePositionSeconds,0);
 await p.play(tag,audioIds[1],80,'SCHEDULE',a.id);
 await p.saveSchedulePosition(tag,sent.at(-1).historyId,30);
 await svc.update(a.id,{resumePlayback:false});
 assert.equal((await db.audioSchedule.findUnique({where:{id:a.id}})).resumePositionSeconds,0);
 result=await p.playOnAllOnline(audioIds[1],80,'SCHEDULE',a.id);assert.equal(result.targeted,2);
 assert.equal(sent.at(-1).startPositionSeconds,0);
 console.log('PASS: first hour, next hour, EOF reset, isolated schedules, single checkpoint owner, stale/out-of-order/device protection, edits and audio changes, disabled compatibility.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 await db.playbackHistory.deleteMany({where:{playerDeviceId:{in:[tag,tag+'-2']}}});
 await db.audioSchedule.deleteMany({where:{id:{in:scheduleIds}}});
 await db.audioPlayer.deleteMany({where:{deviceId:{in:[tag,tag+'-2']}}});
 await db.audio.deleteMany({where:{id:{in:audioIds}}});await db.$disconnect();
});