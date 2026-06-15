import { NextResponse } from 'next/server';
import { userFromReq } from '../../../lib/auth.js';
export async function GET(req) {
  const u = userFromReq(req);
  if (!u) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({ email: u.sub, role: u.role });
}
