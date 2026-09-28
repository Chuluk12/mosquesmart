import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { getRealtimeSocket } from '../lib/socket';
import { PrayerKey } from '@mosque/shared-types';

export interface Mosque { agendaSlidesEnabled?: boolean; prayerSlideSeconds?: number; agendaSlideSeconds?: number; displayBackground?: string; displayLayout?: string; displayTheme?: string; id: string; name: string; address?: string; city?: string; province?: string; latitude?: number; longitude?: number; logo?: string; runningText?: string; timezone: string }
export interface PrayerToday { effective: Record<PrayerKey, string>; iqomah: Record<PrayerKey, number>; stale?: boolean; nextPrayer?: { name: PrayerKey; label: string; time: string; atUtc: string; iqomahMin: number } }
export interface Agenda { hasImage?:boolean; updatedAt?:string; repeatWeekly?:boolean; topic?:string; speakerName?:string; speakerRole?:string; audience?:string; invitation?:string; quote?:string;  id: string; title: string; startDate: string; endDate?: string; description?: string; location?: string }
export interface Content { mediaUrl?: string; durationSeconds?: number; displayOrder?: number; isActive?: boolean; startAt?: string; endAt?: string; id: string; type: string; title?: string; content?: string }

export interface MosqueData {
  mosque: Mosque | null;
  prayer: PrayerToday | null;
  agendas: Agenda[];
  contents: Content[];
  connected: boolean;
  lastError: string | null;
}

const FALLBACK: PrayerToday = {
  effective: { fajr: '04:30', dhuhr: '12:00', asr: '15:15', maghrib: '18:00', isha: '19:15' },
  iqomah: { fajr: 10, dhuhr: 10, asr: 10, maghrib: 5, isha: 10 },
};

/**
 * Polls the public (unauthenticated) endpoints every 30s and keeps the last
 * good response on screen if a poll fails -- the Display TV must keep
 * showing *something* through a brief backend/network blip rather than
 * blanking out.
 */
export function useMosqueData(): MosqueData {
  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [prayer, setPrayer] = useState<PrayerToday | null>(null);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const poll = async () => {
    try {
      const [m, p, ag, ct] = await Promise.all([
        apiGet<Mosque>('/mosque'),
        apiGet<PrayerToday>('/prayers/today'),
        apiGet<Agenda[]>('/agendas?activeOnly=true'),
        apiGet<Content[]>('/contents?activeOnly=true'),
      ]);
      setMosque(m); setPrayer(p); setAgendas(ag); setContents(ct);
      setLastError(null);
    } catch (err) {
      setLastError((err as Error).message);
      // keep previous state on screen; only seed a usable fallback if we
      // have genuinely nothing yet (first boot with backend unreachable).
      setPrayer((prev) => prev ?? FALLBACK);
    }
  };

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 30_000);

    const socket = getRealtimeSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    const refresh = () => poll();
    socket.on('mosque:updated', refresh);
    socket.on('agenda:updated', refresh);
    socket.on('content:updated', refresh);

    return () => {
      clearInterval(interval);
      socket.off('mosque:updated', refresh);
      socket.off('agenda:updated', refresh);
      socket.off('content:updated', refresh);
      socket.disconnect();
    };
  }, []);

  return { mosque, prayer, agendas, contents, connected, lastError };
}


