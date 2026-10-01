require('reflect-metadata');
const assert=require('node:assert/strict');
const {validateSync}=require('class-validator');
const {SpeechDto}=require('../dist/audio/dto/speech.dto');
const {SpeechService}=require('../dist/audio/speech.service');
(async()=>{
 const dto=Object.assign(new SpeechDto(),{text:'Assalamualaikum. Kajian Jumat akan segera dimulai. Silakan menuju mushola.',voice:'id',speed:1});
 assert.equal(validateSync(dto).length,0);
 for(const patch of [{text:'   '},{text:'a'.repeat(3001)},{voice:'invalid'},{speed:2}]) assert.ok(validateSync(Object.assign(new SpeechDto(),dto,patch)).length);
 const service=new SpeechService(); assert.equal((await service.status()).configured,true);
 const first=service.generate(dto); await assert.rejects(service.generate(dto),e=>e.getStatus()===429);
 const result=await first; const audio=Buffer.from(result.base64,'base64');
 assert.equal(result.mimeType,'audio/wav'); assert.equal(audio.toString('ascii',0,4),'RIFF'); assert.equal(audio.toString('ascii',8,12),'WAVE');assert.ok(audio.length>1000);
 const female=await new SpeechService().generate({...dto,voice:'id+f3',speed:0.85});assert.ok(Buffer.from(female.base64,'base64').length>1000);
 const fs=require('node:fs');const path=require('node:path');fs.writeFileSync(path.resolve(__dirname,'../../../.local/espeak-preview.wav'),audio);
 const before=process.env.ESPEAK_PATH;process.env.ESPEAK_PATH='missing-espeak-for-test';
 try{assert.equal((await new SpeechService().status()).configured,false);await assert.rejects(new SpeechService().generate(dto),e=>e.getStatus()===503);}finally{if(before===undefined)delete process.env.ESPEAK_PATH;else process.env.ESPEAK_PATH=before;}
 console.log('PASS: real Indonesian WAV synthesis, both voices, validation, concurrency, missing engine. Preview: .local/espeak-preview.wav');
})().catch(e=>{console.error(e);process.exitCode=1});