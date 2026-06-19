import { NextResponse } from 'next/server';
import { userFromReq, clientDeviceActive } from '../../../lib/auth.js';
import { nicheForBudget } from '../../../lib/claude.js';

export const runtime = 'nodejs';

export async function POST(req) {
  const u = userFromReq(req);
  if (!u) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!(await clientDeviceActive(u))) return NextResponse.json({ error: 'device_revoked', message: 'This device is no longer approved.' }, { status: 403 });
  const { country, budget } = await req.json().catch(() => ({}));
  try {
    const data = await nicheForBudget({ country: (country || 'US'), budget: Number(budget) || 0 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
