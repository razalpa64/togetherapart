// Realtime client — one socket per browser tab, auto-reconnect with backoff.
import { getToken } from './api.js';
import { emit } from './bus.js';

let provider = null; // supabase mode: { connect, disconnect, send }
export function setRealtimeProvider(p) { provider = p; }

let ws = null;
let retry = 0;
let manualClose = false;
let reconnectTimer = null;

export function connect() {
  if (provider) return provider.connect();
  manualClose = false;
  clearTimeout(reconnectTimer);
  const token = getToken();
  if (!token) return;
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  try { ws = new WebSocket(proto + location.host + '/ws?token=' + encodeURIComponent(token)); }
  catch { schedule(); return; }
  ws.onopen = () => { retry = 0; emit('ws:up', {}); };
  ws.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m && m.t) emit('ws:' + m.t, m);
  };
  ws.onclose = () => {
    ws = null;
    if (manualClose) return;
    emit('ws:down', { retry });
    schedule();
  };
  ws.onerror = () => { try { ws && ws.close(); } catch {} };
}
function schedule() {
  retry++;
  reconnectTimer = setTimeout(connect, Math.min(1200 * Math.pow(1.6, retry), 25000));
}
export function send(obj) {
  if (provider) return provider.send(obj);
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}
export function disconnect() {
  if (provider) return provider.disconnect();
  manualClose = true;
  clearTimeout(reconnectTimer);
  if (ws) { try { ws.close(); } catch {} ws = null; }
}
export const connected = () => !!ws && ws.readyState === 1;
