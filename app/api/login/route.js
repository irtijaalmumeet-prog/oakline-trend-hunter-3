import { NextResponse } from 'next/server';
import { ensureOwner, verifyPassword, issueToken } from '../../../lib/auth.js';
import { getUser } from '../../../lib/store.js';

export const runtime = 'nodejs';

export async function POST(req) {
  await ensureOwner();
  const { email, password } = await req.json().catch(() => ({}));
  const user = await getUser(email);
  if (!user || !verifyPassword(password || '', user.salt, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  return NextResponse.json({ token: issueToken(user), user: { email: user.email, role: user.role } });
}
