// Minimal RFC6455 WebSocket server implementation (text frames only) — zero dependencies.
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function acceptKey(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

export class WSConn {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.fragments = null;
    this.alive = true;
    this.user = null;          // set by hub
    this.onmessage = null;
    this.onclose = null;
    socket.setNoDelay(true);
    socket.on('data', d => this._read(d));
    socket.on('close', () => this._dead());
    socket.on('error', () => this._dead());
  }
  _dead() {
    if (!this.alive) return;
    this.alive = false;
    try { this.onclose && this.onclose(); } catch {}
  }
  _read(d) {
    this.buffer = Buffer.concat([this.buffer, d]);
    while (true) {
      const f = this._parse();
      if (!f) return;
      if (f.opcode === 0x8) { this.close(); return; }
      if (f.opcode === 0x9) { this._send(0xA, f.payload); continue; } // ping → pong
      if (f.opcode === 0xA) continue;                                  // pong
      // text (0x1) / continuation (0x0) / binary (0x2 — ignored)
      if (f.opcode === 0x1) this.fragments = { op: f.opcode, chunks: [f.payload] };
      else if (f.opcode === 0x0 && this.fragments) this.fragments.chunks.push(f.payload);
      else continue;
      if (f.fin) {
        const full = Buffer.concat(this.fragments.chunks);
        const msg = full.toString('utf8');
        this.fragments = null;
        if (msg.length > 64 * 1024) { this.close(); return; }
        try { this.onmessage && this.onmessage(JSON.parse(msg)); } catch {}
      }
    }
  }
  _parse() {
    if (this.buffer.length < 2) return null;
    const b0 = this.buffer[0], b1 = this.buffer[1];
    const fin = !!(b0 & 0x80), opcode = b0 & 0x0f, masked = !!(b1 & 0x80);
    let len = b1 & 0x7f, off = 2;
    if (len === 126) { if (this.buffer.length < 4) return null; len = this.buffer.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (this.buffer.length < 10) return null; const big = this.buffer.readBigUInt64BE(2); if (big > 1048576n) { this.close(); return null; } len = Number(big); off = 10; }
    let mask = null;
    if (masked) { if (this.buffer.length < off + 4) return null; mask = this.buffer.subarray(off, off + 4); off += 4; }
    if (this.buffer.length < off + len) return null;
    let payload = this.buffer.subarray(off, off + len);
    if (mask) { const out = Buffer.allocUnsafe(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3]; payload = out; }
    this.buffer = this.buffer.subarray(off + len);
    return { fin, opcode, payload };
  }
  send(obj) {
    if (!this.alive) return;
    try { this._send(0x1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8')); } catch {}
  }
  _send(opcode, payload) {
    const len = payload.length;
    let header;
    if (len < 126) header = Buffer.from([0x80 | opcode, len]);
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    this.socket.write(Buffer.concat([header, payload]));
  }
  ping() { try { this._send(0x9, Buffer.alloc(0)); } catch {} }
  close() { try { this._send(0x8, Buffer.alloc(0)); } catch {} this.socket.destroy(); this._dead(); }
}
