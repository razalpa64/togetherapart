// Realtime hub: per-couple channels, presence tracking, WebRTC signaling relay.
import { WSConn, acceptKey } from './ws.js';
import { now } from './util.js';

const AWAY_GRACE = 8_000;      // reconnect grace before "offline"
const IDLE_AWAY = 5 * 60_000;  // auto-away

export class Realtime {
  constructor(auth) {
    this.auth = auth;
    this.conns = new Set();              // all authenticated sockets
    this.byUser = new Map();             // userId -> Set<conn>
    this.byCouple = new Map();            // coupleId -> Set<conn>
    this.presence = new Map();            // userId -> {state, activity, spot, lastSeen, tz}
    this.pendingOffline = new Map();      // userId -> timeout
    setInterval(() => {
      for (const c of this.conns) if (!c.alive) this.drop(c); else c.ping();
      const t = now();
      for (const [uid, p] of this.presence) {
        if (p.state !== 'offline' && t - p.lastSeen > IDLE_AWAY && !this.byUser.get(uid)?.size) { /* keep last state */ }
      }
    }, 30_000).unref();
  }

  handleUpgrade(req, socket, user) {
    const key = req.headers['sec-websocket-key'];
    if (!key || !user) { socket.destroy(); return; }
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n');
    const conn = new WSConn(socket);
    conn.user = user;
    this.conns.add(conn);
    let set = this.byUser.get(user.id); if (!set) { set = new Set(); this.byUser.set(user.id, set); }
    set.add(conn);
    if (user.coupleId) {
      let cs = this.byCouple.get(user.coupleId); if (!cs) { cs = new Set(); this.byCouple.set(user.coupleId, cs); }
      cs.add(conn);
    }
    const hadTimer = this.pendingOffline.get(user.id);
    if (hadTimer) { clearTimeout(hadTimer); this.pendingOffline.delete(user.id); }
    const firstForUser = set.size === 1;
    this.touch(user.id, {});
    if (firstForUser) this.broadcastCouple(user.coupleId, { t: 'presence', presence: this.snapshotFor(user.coupleId, user.id) }, conn);
    else this.broadcastCouple(user.coupleId, { t: 'presence', presence: this.snapshotFor(user.coupleId, user.id) });

    conn.onmessage = (msg) => {
      this.touch(user.id, {});
      try { this.onClientMessage(conn, msg); } catch {}
    };
    conn.onclose = () => this.drop(conn);
    conn.send({ t: 'hello', presence: this.snapshotFor(user.coupleId, user.id), you: user.id });
  }

  drop(conn) {
    if (!this.conns.has(conn)) return;
    this.conns.delete(conn);
    const u = conn.user;
    const set = this.byUser.get(u.id);
    if (set) { set.delete(conn); if (!set.size) this.byUser.delete(u.id); }
    const cs = this.byCouple.get(u.coupleId);
    if (cs) { cs.delete(conn); if (!cs.size) this.byCouple.delete(u.coupleId); }
    if (!this.byUser.get(u.id)?.size) {
      const timer = setTimeout(() => {
        this.pendingOffline.delete(u.id);
        this.broadcastCouple(u.coupleId, { t: 'presence', presence: this.snapshotFor(u.coupleId, u.id) });
      }, AWAY_GRACE);
      this.pendingOffline.set(u.id, timer);
    }
  }

  touch(userId, patch) {
    const p = this.presence.get(userId) || { state: 'online', activity: null, spot: 'sofaL', lastSeen: 0, tz: null };
    Object.assign(p, patch, { lastSeen: now() });
    this.presence.set(userId, p);
    return p;
  }

  isOnline(userId) { return !!this.byUser.get(userId)?.size; }

  snapshotFor(coupleId, exceptUser) {
    // returns presence info for members of couple (except exceptUser gets full detail of the OTHER)
    const out = {};
    for (const [uid, p] of this.presence) {
      if (uid === exceptUser) continue;
      out[uid] = {
        online: this.isOnline(uid),
        state: this.isOnline(uid) ? p.state : 'offline',
        activity: p.activity || null,
        spot: p.spot,
        tz: p.tz,
        lastSeen: p.lastSeen,
      };
    }
    return out;
  }

  broadcastCouple(coupleId, obj, exceptConn) {
    const cs = this.byCouple.get(coupleId);
    if (!cs) return;
    const s = JSON.stringify(obj);
    for (const c of cs) if (c !== exceptConn && c.alive) c.send(s);
  }

  broadcastUser(userId, obj) {
    const set = this.byUser.get(userId);
    if (!set) return;
    const s = JSON.stringify(obj);
    for (const c of set) if (c.alive) c.send(s);
  }

  onClientMessage(conn, msg) {
    const u = conn.user;
    if (!msg || typeof msg.t !== 'string') return;
    switch (msg.t) {
      case 'ping': conn.send({ t: 'pong' }); return;
      case 'presence': {
        const allowed = ['online','away','busy','watching','playing','listening','just_staying'];
        const state = allowed.includes(msg.state) ? msg.state : 'online';
        this.touch(u.id, { state, activity: msg.activity ?? null, tz: msg.tz ?? null });
        this.broadcastCouple(u.coupleId, { t: 'presence', presence: this.snapshotFor(u.coupleId, u.id) });
        return;
      }
      case 'avatar:move': {
        const spot = String(msg.spot || '').slice(0, 30);
        this.touch(u.id, { spot });
        this.broadcastCouple(u.coupleId, { t: 'avatar:move', userId: u.id, spot }, conn);
        return;
      }
      case 'typing': {
        this.broadcastCouple(u.coupleId, { t: 'chat:typing', userId: u.id, on: !!msg.on }, conn);
        return;
      }
      case 'interaction': {
        const type = String(msg.type || '').slice(0, 20);
        this.broadcastCouple(u.coupleId, { t: 'interaction', from: u.id, type });
        return;
      }
      case 'float': {
        const emoji = String(msg.emoji || '❤️').slice(0, 8);
        this.broadcastCouple(u.coupleId, { t: 'float', from: u.id, emoji });
        return;
      }
      case 'room:patch': {
        this.broadcastCouple(u.coupleId, { t: 'room:patch', patch: msg.patch || {}, by: u.id }, conn);
        return;
      }
      case 'stay': {
        this.broadcastCouple(u.coupleId, { t: 'stay', from: u.id, action: String(msg.action || '').slice(0, 20), env: msg.env, on: !!msg.on }, conn);
        return;
      }
      case 'call:signal': {
        this.broadcastCouple(u.coupleId, { t: 'call:signal', from: u.id, data: msg.data }, conn);
        return;
      }
      case 'song:sync': { // synced-listen control (start countdown ritual etc.)
        this.broadcastCouple(u.coupleId, { t: 'song:sync', from: u.id, data: msg.data || {} }, conn);
        return;
      }
      default: return;
    }
  }
}
