import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { AudioEngine, AudioEngineStatus } from './audio-engine';

/**
 * Windows-native fallback engine, used only when ffplay is not available on
 * the mini-PC (see engine-factory.ts, which prefers ffplay whenever it is
 * on PATH). It drives the built-in Windows Media Player ActiveX control
 * (WMPLib) from a small persistent PowerShell process, so MP3/WAV playback
 * works with zero extra installs on a stock Windows machine.
 *
 * IMPORTANT: this class can only run on Windows and could not be exercised
 * in the Linux development/testing sandbox this project was built in --
 * validate it on the actual target mini-PC before relying on it in
 * production. Installing ffmpeg on the Windows machine and letting
 * FfplayEngine handle playback instead is the better-tested path (see
 * README "Audio playback on Windows").
 */
export class WindowsMediaEngine implements AudioEngine {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private status: AudioEngineStatus = { state: 'IDLE', volume: 80, currentUrl: null };
  private listeners: ((status: AudioEngineStatus) => void)[] = [];

  onStatusChange(cb: (status: AudioEngineStatus) => void) {
    this.listeners.push(cb);
  }

  private setStatus(patch: Partial<AudioEngineStatus>) {
    this.status = { ...this.status, ...patch };
    for (const cb of this.listeners) {
      try { cb(this.status); } catch { /* ignore bad listener */ }
    }
  }

  getStatus() {
    return this.status;
  }

  private ensureProcess() {
    if (this.proc) return;

    // A tight loop that polls WMP's playState and reports it back over
    // stdout as "STATE <n>" lines, and reads one command per stdin line as
    // "PLAY <url> <volume>|STOP|PAUSE|RESUME|VOLUME <v>". WMP OCX drives
    // playback via its own native (DirectShow) thread, so this does not
    // need a WinForms/WPF message pump to decode audio correctly.
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $player = New-Object -ComObject WMPLib.WindowsMediaPlayer
      $player.settings.volume = 80
      $lastState = -1
      while ($true) {
        if ([Console]::In.Peek() -ge 0) {
          $line = [Console]::In.ReadLine()
          if ($null -eq $line) { break }
          $parts = $line.Split(' ')
          switch ($parts[0]) {
            'PLAY'   { $player.URL = $parts[1]; $player.settings.volume = [int]$parts[2]; $player.controls.play() }
            'STOP'   { $player.controls.stop() }
            'PAUSE'  { $player.controls.pause() }
            'RESUME' { $player.controls.play() }
            'VOLUME' { $player.settings.volume = [int]$parts[1] }
          }
        }
        $state = $player.playState
        if ($state -ne $lastState) {
          Write-Output "STATE $state"
          $lastState = $state
        }
        Start-Sleep -Milliseconds 150
      }
    `;

    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.proc = proc;

    proc.stdout.on('data', (chunk) => this.handleLine(chunk.toString()));
    proc.stderr.on('data', (chunk) => {
      this.setStatus({ state: 'ERROR', errorMessage: chunk.toString().trim() });
    });
    proc.on('error', (err) => {
      this.setStatus({ state: 'ERROR', errorMessage: `Failed to start powershell.exe: ${err.message}` });
      this.proc = null;
    });
    proc.on('exit', () => { this.proc = null; });
  }

  // WMP playState: 1=Stopped 2=Paused 3=Playing 8=MediaEnded 6=Buffering 9=Error(approx)
  private handleLine(raw: string) {
    for (const line of raw.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const match = line.match(/^STATE (-?\d+)$/);
      if (!match) continue;
      const code = Number(match[1]);
      if (code === 3) this.setStatus({ state: 'PLAYING' });
      else if (code === 2) this.setStatus({ state: 'PAUSED' });
      else if (code === 8) this.setStatus({ state: 'FINISHED' });
      else if (code === 1 && this.status.state !== 'STOPPED') this.setStatus({ state: 'STOPPED' });
    }
  }

  private send(line: string) {
    try {
      this.proc?.stdin.write(line + '\n');
    } catch (err) {
      this.setStatus({ state: 'ERROR', errorMessage: (err as Error).message });
    }
  }

  async play(url: string, volume: number): Promise<void> {
    try {
      this.ensureProcess();
      this.setStatus({ state: 'LOADING', currentUrl: url, volume, errorMessage: undefined });
      this.send(`PLAY ${url} ${Math.round(Math.min(100, Math.max(0, volume)))}`);
    } catch (err) {
      this.setStatus({ state: 'ERROR', errorMessage: (err as Error).message });
    }
  }

  async stop(): Promise<void> {
    this.setStatus({ state: 'STOPPED' });
    this.send('STOP');
  }

  async pause(): Promise<void> {
    this.send('PAUSE');
  }

  async resume(): Promise<void> {
    this.send('RESUME');
  }

  async setVolume(volume: number): Promise<void> {
    const v = Math.min(100, Math.max(0, volume));
    this.setStatus({ volume: v });
    this.send(`VOLUME ${v}`);
  }
}
