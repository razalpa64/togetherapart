// REST client. Auth token lives in storage (localStorage when available) and is sent as a Bearer header.
// When a Supabase backend is active (see backend/supabase.js), calls are routed to it instead of fetch.
import { storage } from './storage.js';

let provider = null;             // (method, path, body) => data   [supabase mode]
export const setApiProvider = (fn) => { provider = fn; };
let mediaResolver = null;        // (mediaId) => Promise<url>       [supabase mode: signed URLs]
export const setMediaResolver = (fn) => { mediaResolver = fn; };

const TOKEN_KEY = 'ta_token';

export const getToken = () => storage.get(TOKEN_KEY);
export const setToken = (t) => storage.set(TOKEN_KEY, t);
export const clearToken = () => storage.remove(TOKEN_KEY);

export class ApiError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

export async function api(method, path, body) {
  if (provider) {
    try { return await provider(method, path, body); }
    catch (e) { if (e?.status === 401) clearToken(); throw e; }
  }
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
        'X-TA': '1',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('We couldn\'t reach your world. Check your connection and try again.', 0);
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401) { clearToken(); }
    throw new ApiError(data.error || 'Something didn\'t work. Try again?', res.status);
  }
  return data;
}

export async function uploadMedia(file) {
  if (provider) return (await provider('POST', '/api/media', file)).media;
  const res = await fetch('/api/media', {
    method: 'POST',
    headers: { ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}), 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'That upload didn\'t come through. Try again?', res.status);
  return data.media;
}

const DEMO_IMG = {
  'demo:hero-room': 'hero-room.jpg', 'demo:moment-watch': 'moment-watch.jpg', 'demo:moment-game': 'moment-game.jpg',
  'demo:moment-memories': 'moment-memories.jpg', 'demo:moment-dinner': 'moment-dinner.jpg', 'demo:surprise-letter': 'surprise-letter.jpg',
  'demo:stay-rain': 'stay-rain.jpg', 'demo:stay-balcony': 'stay-balcony.jpg', 'demo:stay-beach': 'stay-beach.jpg', 'demo:stay-cabin': 'stay-cabin.jpg',
  'demo:stay-rooftop': 'hero-room.jpg',
};
export const mediaUrl = (id) => {
  if (!id) return '';
  const s = String(id);
  if (s.startsWith('demo:')) return '/img/' + (DEMO_IMG[s] || 'hero-room.jpg');
  if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('http') || s.startsWith('/')) return s;
  return '/api/media/' + encodeURIComponent(s);
};

export const resolveMedia = async (id) => {
  if (!id) return null;
  const s = String(id);
  if (s.startsWith('demo:')) return '/img/' + (DEMO_IMG[s] || 'hero-room.jpg');
  if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('http') || s.startsWith('/')) return s;
  if (mediaResolver) return await mediaResolver(s);
  return '/api/media/' + encodeURIComponent(s);
};
export const img = (name) => '/img/' + name;
