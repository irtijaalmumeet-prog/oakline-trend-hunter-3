// Password hashing (scrypt) + tiny HMAC token + device-approval helper. No external deps.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { getUser, upsertUser, getDevice, touchDevice } from './store.js';

const SECRET = () => process.env.JWT_SECRET || 'dev-insecure-secret';
const TTL = 60 * 60 * 24 * 7;

export function hashPassword(pw, salt = randomBytes(16).toString('hex')) {
  return { salt, passwordHash: scryptSync(pw, salt, 64).toString('hex') };
}
export function verifyPassword(pw, salt, expected) {
  const h = scryptSync(pw, salt, 64), e = Buffer.from(expected, 'hex');
  return h.length === e.length && timingSafeEqual(h, e);
}
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (d) => createHmac('sha256', SECRET()).update(d).digest('base64url');

// Token optionally carries the approved device id (did) for clients.
export function issueToken(user, did) {
  const body = b64u({ sub: user.email, role: user.role, did: did || null, exp: Math.floor(Date.now() / 1000) + TTL });
  return body + '.' + sign(body);
}
export function verifyToken(token) {
  if (!token) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig || sign(body) !== sig) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp < Math.floor(Date.now() / 1000) ? null : p; } catch { return null; }
}
export function userFromReq(req) {
  const h = req.headers.get('authorization') || '';
  return verifyToken(h.replace(/^Bearer /, ''));
}
// Per-request device gate. Owners exempt. Clients must be on an APPROVED device;
// if the owner later blocks/removes it, this returns false and they're kicked out.
export async function clientDeviceActive(payload) {
  if (!payload) return false;
  if (payload.role !== 'client') return true;
  if (!payload.did) return false;
  const d = await getDevice(payload.sub, payload.did);
  if (!d || d.status !== 'approved') return false;
  touchDevice(payload.sub, payload.did).catch(() => {});
  return true;
}
export async function ensureOwner() {
  const email = process.env.OWNER_EMAIL, pw = process.env.OWNER_PASSWORD;
  if (!email || !pw) return;
  if (await getUser(email)) return;
  const { salt, passwordHash } = hashPassword(pw);
  await upsertUser({ email, role: 'owner', salt, passwordHash, createdAt: Date.now() });
}
