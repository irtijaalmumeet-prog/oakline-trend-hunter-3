import { NextResponse } from 'next/server';
import { userFromReq } from '../../../lib/auth.js';
import { listDevices, setDeviceStatus, removeDevice } from '../../../lib/store.js';

export const runtime = 'nodejs';

export async function GET(req) {
  const u = userFromReq(req);
  if (u?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  return NextResponse.json({ devices: await listDevices() });
}
export async function POST(req) {
  const u = userFromReq(req);
  if (u?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  const { email, deviceId, action } = await req.json().catch(() => ({}));
  if (!email || !deviceId) return NextResponse.json({ error: 'email and deviceId required' }, { status: 400 });
  if (action === 'approve') await setDeviceStatus(email, deviceId, 'approved');
  else if (action === 'block') await setDeviceStatus(email, deviceId, 'blocked');
  else return NextResponse.json({ error: 'action must be approve or block' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
export async function DELETE(req) {
  const u = userFromReq(req);
  if (u?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  const deviceId = url.searchParams.get('deviceId');
  if (email && deviceId) await removeDevice(email, deviceId);
  return NextResponse.json({ ok: true });
}
