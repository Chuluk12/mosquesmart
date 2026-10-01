export type PlaybackState = 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'STOPPED' | 'FINISHED' | 'ERROR';

export interface AudioEngineStatus {
  state: PlaybackState;
  volume: number;
  currentUrl: string | null;
  errorMessage?: string;
  positionSeconds?: number;
}

/**
 * Abstraction over "how audio actually comes out of the speakers". The rest
 * of the player service (socket handling, reconnect logic) only talks to
 * this interface, so the underlying playback mechanism can be swapped per
 * platform (Windows Media Player vs ffplay vs a future embedded DAC driver)
 * without touching anything else.
 *
 * Contract: an engine must NEVER throw out of these methods in a way that
 * crashes the host process. Failures are reported via the onStatusChange
 * callback with state 'ERROR' instead.
 */
export interface AudioEngine {
  play(url: string, volume: number, startPositionSeconds?: number): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getStatus(): AudioEngineStatus;
  onStatusChange(cb: (status: AudioEngineStatus) => void): void;
}
