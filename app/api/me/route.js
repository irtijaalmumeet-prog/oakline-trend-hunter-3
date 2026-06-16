import { NextResponse } from 'next/server';
import { userFromReq, clientDeviceActive } from '../../../lib/auth.js';
export const runtime = 'nodejs';
export async function GET(req) {
  const u = userFromReq(req);
  if (!u) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!(await clientDeviceActive(u))) {
    return NextResponse.json({ error: 'device_revoked', message: 'This device is no longer approved.' }, { status: 403 });
  }
  return NextResponse.json({ email: u.sub, role: u.role });
}
