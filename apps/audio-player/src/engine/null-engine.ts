import { AudioEngine, AudioEngineStatus } from './audio-engine';

/**
 * Last-resort engine used when no real playback backend is available at
 * all (e.g. neither ffplay nor Windows are present -- such as this Linux
 * sandbox with ffmpeg removed, or a misconfigured machine). It always
 * reports ERROR instead of throwing, which is what guarantees the overall
 * requirement "Player Service tidak boleh crash" holds even in the worst
 * case.
 */
export class NullEngine implements AudioEngine {
  private status: AudioEngineStatus = { state: 'IDLE', volume: 80, currentUrl: null };
  private listeners: ((status: AudioEngineStatus) => void)[] = [];

  onStatusChange(cb: (status: AudioEngineStatus) => void) {
    this.listeners.push(cb);
  }

  private setStatus(patch: Partial<AudioEngineStatus>) {
    this.status = { ...this.status, ...patch };
    for (const cb of this.listeners) {
      try { cb(this.status); } catch { /* ignore */ }
    }
  }

  getStatus() { return this.status; }

  async play(url: string): Promise<void> {
    this.setStatus({ state: 'ERROR', currentUrl: url, errorMessage: 'No audio playback engine is available on this machine (install ffmpeg, or run on Windows).' });
  }
  async stop(): Promise<void> { this.setStatus({ state: 'STOPPED' }); }
  async pause(): Promise<void> { /* no-op */ }
  async resume(): Promise<void> { /* no-op */ }
  async setVolume(volume: number): Promise<void> { this.setStatus({ volume }); }
}
