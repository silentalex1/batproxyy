export interface Track {
  id: string;
  title: string;
  artist: string;
  handle: string;
  artwork: string;
  duration: number;
  genre: string;
  plays?: number;
  addedAt?: number;
}

export type TrendTime = 'week' | 'month' | 'year' | 'allTime';

export const GENRES = ['All', 'Electronic', 'Hip-Hop/Rap', 'Lo-Fi', 'Pop', 'R&B/Soul', 'House', 'Alternative', 'Rock', 'Ambient', 'Trap', 'Techno', 'Drum & Bass', 'Dubstep', 'Jazz', 'Latin', 'Acoustic', 'Classical'];

const DIRECT = 'https://api.audius.co/v1/';
const RELAY = '/api/music/audius/';
const APP = 'BatProx';

let preferRelay = false;

function qs(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  p.set('app_name', APP);
  return p.toString();
}

async function getJson(path: string, params: Record<string, string | number | undefined>, signal?: AbortSignal) {
  const order = preferRelay ? [RELAY, DIRECT] : [DIRECT, RELAY];
  let lastErr: unknown = null;
  for (const base of order) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 9000);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const r = await fetch(base + path + '?' + qs(params), { signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      preferRelay = base === RELAY;
      return j;
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Music service unreachable');
}

function toTrack(raw: any): Track | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  if (raw.is_streamable === false || raw.is_stream_gated || raw.stream_conditions || raw.is_delete || raw.is_unlisted) return null;
  const art = raw.artwork || {};
  return {
    id: String(raw.id),
    title: String(raw.title || 'Untitled'),
    artist: String(raw.user?.name || raw.user?.handle || 'Unknown artist'),
    handle: String(raw.user?.handle || ''),
    artwork: String(art['480x480'] || art['1000x1000'] || art['150x150'] || ''),
    duration: Number(raw.duration) || 0,
    genre: String(raw.genre || ''),
    plays: Number(raw.play_count) || 0
  };
}

const mapList = (j: any) => (Array.isArray(j?.data) ? j.data : []).map(toTrack).filter((t: Track | null): t is Track => !!t);

export async function trending(genre: string, time: TrendTime, signal?: AbortSignal): Promise<Track[]> {
  const j = await getJson('tracks/trending', { genre: genre === 'All' ? undefined : genre, time, limit: 60 }, signal);
  return mapList(j);
}

export async function searchTracks(query: string, signal?: AbortSignal): Promise<Track[]> {
  const j = await getJson('tracks/search', { query, limit: 40 }, signal);
  return mapList(j);
}

export function streamUrl(id: string, viaRelay: boolean) {
  return (viaRelay ? RELAY : DIRECT) + 'tracks/' + encodeURIComponent(id) + '/stream?' + qs({});
}

export function shouldRelayFirst() {
  return preferRelay;
}

export function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}
