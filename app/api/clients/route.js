import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { userFromReq, hashPassword } from '../../../lib/auth.js';
import { listClients, getUser, upsertUser, removeUser, setUserPassword, setUserExpiry } from '../../../lib/store.js';

export const runtime = 'nodejs';

function daysToExpiry(days) {
  const n = Number(days);
  return n && n > 0 ? Date.now() + n * 86400000 : null;
}

export async function GET(req) {
  const u = userFromReq(req);
  if (u?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  return NextResponse.json({ clients: await listClients() });
}

// Create a client. Optional accessDays sets how long they may use the tool.
export async function POST(req) {
  const u = userFromReq(req);
  if (u?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  const { email, accessDays } = await req.json().catch(() => ({}));
  if (!email || !/.+@.+\..+/.test(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  if (await getUser(email)) return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  const tempPassword = randomBytes(6).toString('base64url');
  const { salt, passwordHash } = hashPassword(tempPassword);
  await upsertUser({ email, role: 'client', salt, passwordHash, createdAt: Date.now(), createdBy: u.sub, expiresAt: daysToExpiry(accessDays) });
  return NextResponse.json({ email, tempPassword });
}

// Update a client: set a new password and/or set access days (0 / blank = unlimited).
export async function PUT(req) {
  const u = userFromReq(req);
  if (u?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  const { email, password, accessDays } = await req.json().catch(() => ({}));
  const target = email && await getUser(email);
  if (!target || target.role !== 'client') return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (password) {
    const { salt, passwordHash } = hashPassword(String(password));
    await setUserPassword(email, salt, passwordHash);
  }
  if (accessDays !== undefined) {
    await setUserExpiry(email, daysToExpiry(accessDays));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const u = userFromReq(req);
  if (u?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  const email = new URL(req.url).searchParams.get('email');
  if (email) await removeUser(email);
  return NextResponse.json({ ok: true });
}
