import { Injectable, ServiceUnavailableException, BadGatewayException, HttpException } from '@nestjs/common';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, readFile, unlink, rmdir } from 'fs/promises';
import { resolve, join, dirname } from 'path';
import { tmpdir } from 'os';
import { SpeechDto } from './dto/speech.dto';

export function espeakExecutable() {
  if (process.env.ESPEAK_PATH) return process.env.ESPEAK_PATH;
  if (process.platform === 'win32') {
    const candidates = [resolve(process.cwd(), '../../.local/espeak/portable/eSpeak NG/espeak-ng.exe'), resolve(process.cwd(), '.local/espeak/portable/eSpeak NG/espeak-ng.exe'), 'C:/Program Files/eSpeak NG/espeak-ng.exe', 'C:/Program Files (x86)/eSpeak NG/espeak-ng.exe'];
    const installed = candidates.find(p=>existsSync(p));
    if (installed) return installed;
  }
  return 'espeak-ng';
}
export function runEspeak(args: string[], text?: string): Promise<string> {
  return new Promise((resolveResult,reject)=>{
    const executable = espeakExecutable();
    const dataArgs = process.platform === 'win32' && existsSync(join(dirname(executable), 'espeak-ng-data')) ? ['--path=' + dirname(executable)] : [];
    const child = execFile(executable, [...dataArgs, ...args], {timeout:60000,maxBuffer:1024*1024,windowsHide:true,encoding:'utf8'}, (error,stdout)=>error?reject(error):resolveResult(stdout));
    child.stdin?.on('error',()=>{});
    child.stdin?.end(text, 'utf8');
  });
}
@Injectable()
export class SpeechService {
  private busy = false;
  private nextRequest = 0;
  async status() {
    try { const voices=await runEspeak(['--voices=id']); return {configured:/Indonesian/i.test(voices),provider:'eSpeak NG'}; }
    catch { return {configured:false,provider:'eSpeak NG'}; }
  }
  async generate(dto: SpeechDto) {
    if (this.busy || Date.now()<this.nextRequest) throw new HttpException('Tunggu sebentar sebelum membuat suara lagi.',429);
    this.busy=true;
    let directory: string | undefined;
    try {
      if (!(await this.status()).configured) throw new ServiceUnavailableException('eSpeak NG belum tersedia. Pasang eSpeak NG pada server API atau atur ESPEAK_PATH.');
      directory=await mkdtemp(join(tmpdir(),'mosque-tts-'));
      const output=join(directory,'speech.wav');
      await runEspeak(['-v',dto.voice,'-s',String(Math.round(155*dto.speed)),'-b','1','-w',output,'--stdin'],dto.text.trim());
      const audio=await readFile(output);
      if(audio.length<=44 || audio.toString('ascii',0,4)!=='RIFF' || audio.toString('ascii',8,12)!=='WAVE') throw new Error('Invalid WAV');
      return {base64:audio.toString('base64'),mimeType:'audio/wav'};
    } catch(error) {
      if(error instanceof ServiceUnavailableException) throw error;
      throw new BadGatewayException('Suara gagal dibuat oleh eSpeak NG. Periksa instalasi dan izin folder sementara server.');
    } finally {
      if(directory) { await unlink(join(directory,'speech.wav')).catch(()=>{}); await rmdir(directory).catch(()=>{}); }
      this.busy=false; this.nextRequest=Date.now()+1000;
    }
  }
}