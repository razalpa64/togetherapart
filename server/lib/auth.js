import crypto from 'node:crypto';
import { T, one, save } from './db.js';
import { id, now, isEmail, clean } from './util.js';

const SESSION_DAYS = 30;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(password, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(test), Buffer.from(hash));
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  T('sessions').push({ id: id('s'), tokenHash: sha(token), userId, expiresAt: now() + SESSION_DAYS * 86400000, createdAt: now() });
  save();
  return token;
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function destroySession(token) {
  const h = sha(token);
  const i = T('sessions').findIndex(s => s.tokenHash === h);
  if (i >= 0) { T('sessions').splice(i, 1); save(); }
}

export function userForToken(token) {
  if (!token) return null;
  const sess = one('sessions', s => s.tokenHash === sha(token));
  if (!sess || sess.expiresAt < now()) return null;
  const user = one('users', u => u.id === sess.userId);
  if (!user) return null;
  const member = one('members', m => m.userId === user.id);
  return { ...user, coupleId: member ? member.coupleId : null, member: member || null };
}

export function tokenFromReq(req, url) {
  const h = req.headers['authorization'];
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  if (url && url.searchParams.get('token')) return url.searchParams.get('token');
  return null;
}

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, avatar: u.avatar || null, tz: u.tz || null, demo: !!u.demo, coupleId: u.coupleId || null };
}

export function signup({ email, password, name }) {
  email = clean(email, 120).toLowerCase();
  name = clean(name, 40);
  if (!isEmail(email)) throw new Error('That email doesn\'t look right.');
  if (password.length < 8) throw new Error('Passwords need at least 8 characters.');
  if (!name) throw new Error('Tell us your name — even a nickname works.');
  if (one('users', u => u.email === email)) throw new Error('Someone already uses this email. Try logging in.');
  const { salt, hash } = hashPassword(password);
  const user = { id: id('u'), email, passSalt: salt, passHash: hash, name, avatar: null, tz: null, createdAt: now(), demo: false };
  T('users').push(user);
  save();
  return user;
}

export function login(email, password) {
  email = clean(email, 120).toLowerCase();
  const user = one('users', u => u.email === email);
  if (!user || !verifyPassword(password || '', user.passSalt, user.passHash)) throw new Error('That email and password don\'t match.');
  return user;
}

export function createReset(email) {
  email = clean(email, 120).toLowerCase();
  const user = one('users', u => u.email === email);
  if (!user) return null; // don't reveal existence
  const token = crypto.randomBytes(24).toString('base64url');
  T('resets').push({ tokenHash: sha(token), userId: user.id, expiresAt: now() + 3600_000 });
  save();
  return token;
}
export function consumeReset(token, newPassword) {
  if (!newPassword || newPassword.length < 8) throw new Error('New passwords need at least 8 characters.');
  const r = one('resets', x => x.tokenHash === sha(token));
  if (!r || r.expiresAt < now()) throw new Error('This reset link has expired. Request a new one.');
  const user = one('users', u => u.id === r.userId);
  if (!user) throw new Error('This reset link is no longer valid.');
  const { salt, hash } = hashPassword(newPassword);
  user.passSalt = salt; user.passHash = hash;
  T('resets', x => x.tokenHash === r.tokenHash) && save();
  return user;
}
