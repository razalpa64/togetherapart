// Tiny event bus shared across the app.
const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => {
  const wrap = (e) => fn(e.detail);
  bus.addEventListener(type, wrap);
  return () => bus.removeEventListener(type, wrap);
};
export const once = (type, fn) => {
  const off = on(type, (d) => { off(); fn(d); });
  return off;
};
