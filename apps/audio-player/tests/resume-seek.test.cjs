const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FfplayEngine}=require('../dist/engine/ffplay-engine');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mosque-seek-')),file=path.join(dir,'silent.wav');
 const rate=16000,n=rate*4,buf=Buffer.alloc(44+n*2);
 buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(rate,24);buf.writeUInt32LE(rate*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*2,40);fs.writeFileSync(file,buf);
 process.env.SDL_AUDIODRIVER='dummy';
 const engine=new FfplayEngine(),states=[];
 let timer;
 try{
  const done=new Promise((resolve,reject)=>{
   timer=setTimeout(()=>reject(new Error('ffplay timeout: '+JSON.stringify(engine.getStatus()))),12000);
   engine.onStatusChange(s=>{states.push({...s});if(s.state==='FINISHED')resolve();if(s.state==='ERROR')reject(new Error(s.errorMessage));});
  });
  await engine.play(file,0,2);await done;
  assert.ok(states.some(s=>s.state==='PLAYING'));
  assert.ok(engine.getStatus().positionSeconds>=3,'media clock must track absolute seek position');
  console.log('PASS: real ffplay seeks from 2s, reports absolute position and natural FINISHED; silent dummy audio output.');
 }finally{clearTimeout(timer);await engine.stop();fs.unlinkSync(file);fs.rmdirSync(dir);}
})().catch(e=>{console.error(e);process.exitCode=1});