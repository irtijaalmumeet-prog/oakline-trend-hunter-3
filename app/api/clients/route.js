import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { userFromReq, hashPassword } from '../../../lib/auth.js';
import { listClients, getUser, upsertUser, removeUser } from '../../../lib/store.js';

export const runtime = 'nodejs';

export async function GET(req) {
  const u = userFromReq(req);
  if (u?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  return NextResponse.json({ clients: await listClients() });
}
export async function POST(req) {
  const u = userFromReq(req);
  if (u?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  const { email } = await req.json().catch(() => ({}));
  if (!email || !/.+@.+\..+/.test(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  if (await getUser(email)) return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  const tempPassword = randomBytes(6).toString('base64url');
  const { salt, passwordHash } = hashPassword(tempPassword);
  await upsertUser({ email, role: 'client', salt, passwordHash, createdAt: Date.now(), createdBy: u.sub });
  return NextResponse.json({ email, tempPassword });
}
export async function DELETE(req) {
  const u = userFromReq(req);
  if (u?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  const email = new URL(req.url).searchParams.get('email');
  if (email) await removeUser(email);
  return NextResponse.json({ ok: true });
}
