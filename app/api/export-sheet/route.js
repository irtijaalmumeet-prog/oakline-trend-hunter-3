import { NextResponse } from 'next/server';
import { userFromReq, clientDeviceActive } from '../../../lib/auth.js';
import { createClientSheet } from '../../../lib/googleSheets.js';

export const runtime = 'nodejs';

export async function POST(req) {
  const u = userFromReq(req);
  if (!u) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!(await clientDeviceActive(u))) return NextResponse.json({ error: 'device_revoked', message: 'This device is no longer approved.' }, { status: 403 });

  const { niche, country, products } = await req.json().catch(() => ({}));
  const header = ['Product', 'Why now', 'Audience', 'Demand', 'Competition', 'Score/10', 'Facebook Ads (active)', 'TikTok Shop', 'AliExpress', 'Amazon', 'Image search'];
  const linkOf = (p, n) => { const f = (p.links || []).find((x) => x.name === n); return f ? f.url : ''; };
  const rows = (products || []).map((p) => [
    p.name, p.whyNow, p.audience, p.demandScore, p.competitionScore, p.finalScore,
    linkOf(p, 'Facebook Ads Library'), linkOf(p, 'TikTok Shop'), linkOf(p, 'AliExpress'), linkOf(p, 'Amazon'),
    'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(p.name || ''),
  ]);
  const title = 'Oakline — ' + (niche || 'Hunt') + ' — ' + (country || '') + ' — ' + new Date().toISOString().slice(0, 10);

  try {
    const out = await createClientSheet({ title, header, rows, shareEmail: u.sub });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
