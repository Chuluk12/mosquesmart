import { ChildProcessByStdio, spawn } from 'child_process';
import { Readable } from 'stream';
import { AudioEngine, AudioEngineStatus, PlaybackState } from './audio-engine';

/**
 * Cross-platform engine backed by ffplay (part of ffmpeg). Used as the
 * default on Linux/macOS, and as a fallback on Windows if ffmpeg has been
 * installed manually. Pause/Resume use POSIX process signals (SIGSTOP/
 * SIGCONT) which are not available on Windows -- on Windows the primary
 * engine is WindowsMediaEngine (see windows-media-engine.ts), which
 * implements real pause/resume instead of relying on this fallback.
 */
export class FfplayEngine implements AudioEngine {
  private proc: ChildProcessByStdio<null, Readable, Readable> | null = null;
  private status: AudioEngineStatus = { state: 'IDLE', volume: 80, currentUrl: null };
  private listeners: ((status: AudioEngineStatus) => void)[] = [];
  private paused = false;

  onStatusChange(cb: (status: AudioEngineStatus) => void) {
    this.listeners.push(cb);
  }

  private setStatus(patch: Partial<AudioEngineStatus>) {
    this.status = { ...this.status, ...patch };
    for (const cb of this.listeners) {
      try { cb(this.status); } catch { /* a bad listener must not break playback */ }
    }
  }

  getStatus() {
    return this.status;
  }

  async play(url: string, volume: number, startPositionSeconds = 0): Promise<void> {
    await this.killCurrent();
    this.setStatus({ state: 'LOADING', currentUrl: url, volume, errorMessage: undefined, positionSeconds: startPositionSeconds });

    try {
      const proc = spawn('ffplay', [
        '-nodisp', '-autoexit', '-stats', '-loglevel', 'error', '-ss', String(startPositionSeconds),
        '-volume', String(Math.round(this.clampVolume(volume))),
        url,
      ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

      this.proc = proc;
      this.paused = false;

      let sawError = '';
      let pending = '';
      proc.stderr.on('data', (chunk) => {
        if (this.proc !== proc) return;
        pending += chunk.toString();
        const lines = pending.split(/[\r\n]/);
        pending = lines.pop() || '';
        for (const line of lines) {
          const clock = line.match(/^\s*(\d+(?:\.\d+)?)\s+(?:(?:M-A|A-V|M-V))?:/);
          if (clock) {
            this.status.positionSeconds = Math.max(startPositionSeconds, Number(clock[1]));
            if (this.status.state === 'LOADING') this.setStatus({ state: 'PLAYING' });
          } else if (line.trim() && !/\bnan\b.*(?:(?:M-A|A-V|M-V))?:/.test(line)) sawError = (sawError + line + '\n').slice(-8192);
        }
      });

      // PLAYING starts only when ffplay reports its media clock.

      proc.on('error', (err) => {
        if (this.proc !== proc) return;
        // e.g. ffplay binary not found on PATH
        this.setStatus({ state: 'ERROR', errorMessage: `Failed to start ffplay: ${err.message}` });
        this.proc = null;
      });

      proc.on('close', (code, signal) => {
        // A replaced/stopped process must not change the new playback's status.
        if (this.proc !== proc) return;
        this.proc = null;
        if (this.status.state === 'STOPPED') return; // we caused this exit ourselves
        // ffplay can exit with code 0 even when it failed to resolve/open
        // the stream (observed with unreachable hosts) -- the only
        // reliable signal in that case is that it wrote to stderr, so a
        // clean finish additionally requires an empty stderr.
        const errorText = sawError.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').trim();
        if (code === 0 && !errorText) {
          this.setStatus({ state: 'FINISHED' });
        } else {
          this.setStatus({ state: 'ERROR', errorMessage: errorText || `ffplay exited with code ${code}, signal ${signal}` });
        }
      });
    } catch (err) {
      // Belt-and-suspenders: spawn() itself throwing must not crash the process.
      this.setStatus({ state: 'ERROR', errorMessage: (err as Error).message });
    }
  }

  async stop(): Promise<void> {
    if (!this.proc) { this.setStatus({ state: 'STOPPED' }); return; }
    this.setStatus({ state: 'STOPPED' });
    await this.killCurrent();
  }

  async pause(): Promise<void> {
    if (this.proc && !this.paused && process.platform !== 'win32') {
      this.proc.kill('SIGSTOP');
      this.paused = true;
      this.setStatus({ state: 'PAUSED' });
    }
  }

  async resume(): Promise<void> {
    if (this.proc && this.paused && process.platform !== 'win32') {
      this.proc.kill('SIGCONT');
      this.paused = false;
      this.setStatus({ state: 'PLAYING' });
    }
  }

  async setVolume(volume: number): Promise<void> {
    // ffplay has no live-volume IPC; applied on the next play() call. We
    // still record it immediately so getStatus() reflects the requested value.
    this.setStatus({ volume: this.clampVolume(volume) });
  }

  private clampVolume(v: number) {
    return Math.min(100, Math.max(0, v));
  }

  private async killCurrent(): Promise<void> {
    if (!this.proc) return;
    const proc = this.proc;
    this.proc = null;
    try {
      proc.kill('SIGKILL');
    } catch { /* process may already be gone */ }
  }
}
