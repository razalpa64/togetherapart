export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
let provider = null, resolver = null;
export const setApiProvider = (fn) => { provider = fn; };
export const setMediaResolver = (fn) => { resolver = fn; };
export const getProvider = () => provider;
export const getResolver = () => resolver;
export const setToken = () => {};
export const clearToken = () => {};
export const getToken = () => 'sb-session';
