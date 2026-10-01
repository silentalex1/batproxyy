import type { Track } from './audius';

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
}

export interface Library {
  liked: Track[];
  playlists: Playlist[];
  plays: Track[];
}

export interface AiMix {
  reply: string;
  name: string;
  tracks: Track[];
  queries: string[];
  basedOn: { artists: string[]; genres: string[] };
  ai: boolean;
}

export const EMPTY_LIBRARY: Library = { liked: [], playlists: [], plays: [] };

const token = () => { try { return localStorage.getItem('batprox-token') || ''; } catch { return ''; } };
const cacheKey = () => { try { return 'bp-music-lib-' + (localStorage.getItem('batprox-user') || 'guest'); } catch { return 'bp-music-lib-guest'; } };

export function hasAccount() {
  return !!token();
}

export function cachedLibrary(): Library {
  try {
    const raw = localStorage.getItem(cacheKey());
    if (!raw) return EMPTY_LIBRARY;
    const p = JSON.parse(raw);
    return { liked: Array.isArray(p.liked) ? p.liked : [], playlists: Array.isArray(p.playlists) ? p.playlists : [], plays: Array.isArray(p.plays) ? p.plays : [] };
  } catch {
    return EMPTY_LIBRARY;
  }
}

function remember(lib: Library) {
  try { localStorage.setItem(cacheKey(), JSON.stringify(lib)); } catch {}
  return lib;
}

async function raw(path: string, method: 'GET' | 'POST', body?: unknown): Promise<any> {
  const t = token();
  if (!t) throw new Error('Sign in to BatProx to save music to your library.');
  const r = await fetch('/api/music/' + path, {
    method,
    headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let j: any = null;
  try { j = await r.json(); } catch {}
  if (!r.ok || !j || j.error) throw new Error((j && j.error) || 'Could not reach your library.');
  return j;
}

async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Library> {
  const j = await raw(path, method, body);
  return remember({ liked: Array.isArray(j.liked) ? j.liked : [], playlists: Array.isArray(j.playlists) ? j.playlists : [], plays: Array.isArray(j.plays) ? j.plays : [] });
}

const slim = (t: Track) => ({ id: t.id, title: t.title, artist: t.artist, handle: t.handle, artwork: t.artwork, duration: t.duration, genre: t.genre, mood: t.mood || '', tags: t.tags || '' });

export const loadLibrary = () => call('library', 'GET');
export const setLiked = (track: Track, liked: boolean) => call('like', 'POST', { track: slim(track), liked });
export const createPlaylist = (name: string, track?: Track, tracks?: Track[]) => call('playlists', 'POST', { action: 'create', name, track: track ? slim(track) : undefined, tracks: tracks ? tracks.slice(0, 100).map(slim) : undefined });
export const recordPlay = (track: Track) => call('play', 'POST', { track: slim(track) });
export async function askMusicAi(prompt: string): Promise<AiMix> {
  const j = await raw('ai', 'POST', { prompt });
  return {
    reply: String(j.reply || ''),
    name: String(j.name || 'Made for you'),
    tracks: Array.isArray(j.tracks) ? j.tracks : [],
    queries: Array.isArray(j.queries) ? j.queries : [],
    basedOn: { artists: Array.isArray(j.basedOn?.artists) ? j.basedOn.artists : [], genres: Array.isArray(j.basedOn?.genres) ? j.basedOn.genres : [] },
    ai: !!j.ai
  };
}
export const renamePlaylist = (playlistId: string, name: string) => call('playlists', 'POST', { action: 'rename', playlistId, name });
export const deletePlaylist = (playlistId: string) => call('playlists', 'POST', { action: 'delete', playlistId });
export const addToPlaylist = (playlistId: string, track: Track) => call('playlists', 'POST', { action: 'add', playlistId, track: slim(track) });
export const removeFromPlaylist = (playlistId: string, trackId: string) => call('playlists', 'POST', { action: 'remove', playlistId, trackId });
