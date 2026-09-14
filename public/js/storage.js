// Storage that survives sandboxed iframes, private modes, anything — falls back to memory.
let ls = null;
const mem = {};
try {
  const t = '__ta_probe';
  localStorage.setItem(t, '1');
  localStorage.removeItem(t);
  ls = localStorage;
} catch { ls = null; }

export const storage = {
  get(k) {
    try { if (ls) return ls.getItem(k); } catch {}
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
  },
  set(k, v) {
    try { if (ls) ls.setItem(k, String(v)); } catch {}
    mem[k] = String(v);
  },
  remove(k) {
    try { if (ls) ls.removeItem(k); } catch {}
    delete mem[k];
  },
};
