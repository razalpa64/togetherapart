// Minimal fluent mock of the supabase-js surface the app's backend uses.
// Records every table + method chain so the smoke test can assert wiring.
export const calls = [];
function chain(table, resolve) {
  const state = { trace: [] };
  const proxy = new Proxy(state, {
    get(target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        const p = Promise.resolve().then(() => resolve(table, target.trace));
        return p[prop].bind(p);
      }
      if (typeof prop === 'symbol') return undefined;
      return (...args) => { target.trace.push([String(prop), args]); return proxy; };
    },
  });
  return proxy;
}
const DEFAULT = { data: 'CANNED', error: null };
let behavior = () => DEFAULT;
export const setBehavior = (fn) => { behavior = fn; };
export const lastTraces = () => calls.splice(0);

export function createClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({}),
      signUp: async () => ({ data: { session: null }, error: { message: 'Email not confirmed' } }),
      signInWithPassword: async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
      signInWithOAuth: async () => ({ error: null }),
    },
    from: (table) => chain(table, (t, trace) => { calls.push([t, trace]); return behavior(t, trace); }),
    rpc: async (name, args) => ({ data: behavior('__rpc__:' + name, [['rpc', [args]]]), error: null }),
    storage: {
      from: (bucket) => ({
        createSignedUrl: async (path, secs) => ({ data: { signedUrl: 'https://signed/' + bucket + '/' + path + '?t=' + secs } }),
        upload: async () => ({ error: null }),
      }),
    },
    channel: () => {
      const chan = {
        on() { return chan; },
        async subscribe(cb) { if (cb) cb('SUBSCRIBED'); return 'SUBSCRIBED'; },
        async track() {},
        send() {},
      };
      return chan;
    },
    removeChannel: async () => {},
  };
}
