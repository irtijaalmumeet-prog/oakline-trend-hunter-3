// Password hashing (scrypt) + tiny HMAC token. No external deps.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { getUser, upsertUser } from './store.js';

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

export function issueToken(user) {
  const body = b64u({ sub: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + TTL });
  return body + '.' + sign(body);
}
export function verifyToken(token) {
  if (!token) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig || sign(body) !== sig) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp < Math.floor(Date.now() / 1000) ? null : p; } catch { return null; }
}
// Read the bearer token from a Next.js request.
export function userFromReq(req) {
  const h = req.headers.get('authorization') || '';
  return verifyToken(h.replace(/^Bearer /, ''));
}
// Create the owner from env on first use (now async — store may be a database).
export async function ensureOwner() {
  const email = process.env.OWNER_EMAIL, pw = process.env.OWNER_PASSWORD;
  if (!email || !pw) return;
  if (await getUser(email)) return;
  const { salt, passwordHash } = hashPassword(pw);
  await upsertUser({ email, role: 'owner', salt, passwordHash, createdAt: Date.now() });
}
