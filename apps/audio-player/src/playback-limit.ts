import type { PlaybackState } from './engine/audio-engine';

/** Local playback budget; survives socket disconnects and excludes pauses. */
export class PlaybackLimit {
  private timer?: ReturnType<typeof setTimeout>;
  private remaining = 0;
  private startedAt?: number;
  private generation = 0;
  constructor(private readonly expire: () => void, private readonly now = () => performance.now()) {}

  clear() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.startedAt = undefined;
    this.remaining = 0;
    this.generation++;
  }

  configure(minutes?: number | null) {
    this.clear();
    if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0 && minutes <= 1440) {
      this.remaining = minutes * 60_000;
    }
  }

  update(state: PlaybackState) {
    if (['STOPPED', 'FINISHED', 'ERROR', 'IDLE'].includes(state)) { this.clear(); return; }
    if (state === 'PAUSED' || state === 'LOADING') {
      if (this.startedAt !== undefined) this.remaining = Math.max(0, this.remaining - (this.now() - this.startedAt));
      this.startedAt = undefined;
      clearTimeout(this.timer);
      this.timer = undefined;
      return;
    }
    if (state !== 'PLAYING' || this.startedAt !== undefined || this.remaining <= 0) return;
    this.startedAt = this.now();
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.clear();
      this.expire();
    }, this.remaining);
  }
}
