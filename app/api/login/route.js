import { NextResponse } from 'next/server';
import { ensureOwner, verifyPassword, issueToken } from '../../../lib/auth.js';
import { getUser, getDevice, upsertDevice, touchDevice } from '../../../lib/store.js';

export const runtime = 'nodejs';

export async function POST(req) {
  await ensureOwner();
  const { email, password, deviceId, deviceLabel } = await req.json().catch(() => ({}));
  const user = await getUser(email);
  if (!user || !verifyPassword(password || '', user.salt, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  if (user.role !== 'client') {
    return NextResponse.json({ token: issueToken(user), user: { email: user.email, role: user.role } });
  }
  // Access expiry (owner-set timer)
  if (user.expiresAt && Date.now() > user.expiresAt) {
    return NextResponse.json({ error: 'access_expired', message: 'Your access has expired. Please contact the owner.' }, { status: 403 });
  }
  if (!deviceId) {
    return NextResponse.json({ error: 'no_device', message: 'Could not identify this device. Enable cookies/site data and retry.' }, { status: 400 });
  }
  const d = await getDevice(email, deviceId);
  if (!d) {
    await upsertDevice({ email, deviceId, status: 'pending', label: deviceLabel || '', createdAt: Date.now(), lastSeen: Date.now() });
    return NextResponse.json({ error: 'device_pending', message: 'This is a new device. Ask the owner to approve it, then sign in again.' }, { status: 403 });
  }
  if (d.status === 'blocked') {
    return NextResponse.json({ error: 'device_blocked', message: 'This device has been blocked by the owner.' }, { status: 403 });
  }
  if (d.status !== 'approved') {
    return NextResponse.json({ error: 'device_pending', message: 'This device is still waiting for owner approval.' }, { status: 403 });
  }
  await touchDevice(email, deviceId);
  return NextResponse.json({ token: issueToken(user, deviceId), user: { email: user.email, role: user.role } });
}
