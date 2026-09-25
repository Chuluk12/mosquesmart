import { execFileSync } from 'child_process';
import { AudioEngine } from './audio-engine';
import { FfplayEngine } from './ffplay-engine';
import { WindowsMediaEngine } from './windows-media-engine';
import { NullEngine } from './null-engine';

function commandExists(cmd: string): boolean {
  try {
    const checker = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(checker, [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Picks the best available engine for this machine, in order of how well
 * each has actually been validated:
 *   1. ffplay, if installed -- identical, tested code path on every OS.
 *   2. Windows Media Player (via PowerShell), if on win32 -- untested in
 *      this sandbox but needs no extra install on a stock Windows PC.
 *   3. NullEngine -- reports errors instead of crashing.
 */
export function createAudioEngine(): AudioEngine {
  if (commandExists('ffplay')) {
    console.log('[PLAYER] Using FfplayEngine (ffmpeg detected on PATH)');
    return new FfplayEngine();
  }
  if (process.platform === 'win32') {
    console.log('[PLAYER] ffmpeg not found; falling back to WindowsMediaEngine. For best reliability, install ffmpeg and add it to PATH.');
    return new WindowsMediaEngine();
  }
  console.error('[PLAYER] No playback engine available (install ffmpeg). Running in degraded mode: commands will be accepted but nothing will play.');
  return new NullEngine();
}
