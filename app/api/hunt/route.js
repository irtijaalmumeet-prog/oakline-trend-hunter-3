import { NextResponse } from 'next/server';
import { userFromReq, clientDeviceActive } from '../../../lib/auth.js';
import { dailyTrends, relatedQueries } from '../../../lib/googleTrends.js';
import { productIdeas, suggestNiche } from '../../../lib/claude.js';
import { scoreIdeas } from '../../../lib/score.js';
import { platformLinks } from '../../../lib/platformLinks.js';
import { searchVideos, youtubeEnabled } from '../../../lib/youtube.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  const u = userFromReq(req);
  if (!u) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!(await clientDeviceActive(u))) return NextResponse.json({ error: 'device_revoked', message: 'This device is no longer approved.' }, { status: 403 });

  let { niche, country, letAiDecide } = await req.json().catch(() => ({}));
  country = (country || 'US').toUpperCase();
  const warnings = [];

  try {
    if (letAiDecide || !niche) {
      const s = await suggestNiche(country);
      niche = s.niche;
    }

    // 1) Live trending searches for the country (real, changes daily)
    let daily = [];
    try { daily = await dailyTrends(country); }
    catch (e) { warnings.push('Daily trends unavailable: ' + e.message); }

    // 2) Rising/related queries for the niche (real, niche+country specific)
    let related = { top: [], rising: [] };
    try { related = await relatedQueries(niche, country); }
    catch (e) { warnings.push('Niche trend detail unavailable: ' + e.message); }

    const trendTerms = [
      ...related.rising.map((r) => r.query),
      ...related.top.map((r) => r.query),
      ...daily.slice(0, 10).map((d) => d.query),
    ].filter(Boolean);

    // 3) Claude turns the niche + live trends into scored product ideas
    let ideasRaw = [];
    try { ideasRaw = await productIdeas({ niche, country, trendTerms }); }
    catch (e) { warnings.push('AI error: ' + (e && e.message ? e.message : 'unknown')); }
    const MIN_SCORE = 8;     // prefer products scoring 8/10 or higher
    const MAX_PRODUCTS = 15; // cap how many to show
    const scored = scoreIdeas(ideasRaw);
    let chosen = scored.filter((p) => p.finalScore >= MIN_SCORE).slice(0, MAX_PRODUCTS);
    if (chosen.length === 0) {            // never show an empty result
      chosen = scored.slice(0, MAX_PRODUCTS);
      if (chosen.length) warnings.push('No products reached 8/10 this run — showing the strongest available.');
    }
    if (scored.length === 0) warnings.push('AI returned 0 ideas (' + (ideasRaw ? ideasRaw.length : 0) + ' raw). Check Claude API key/credits in Vercel, or try again.');
    const products = chosen.map((p) => ({ ...p, links: platformLinks(p.name, country) }));

    // 4) optional YouTube demand signal for the niche
    let youtube = [];
    if (youtubeEnabled()) { try { youtube = await searchVideos(niche, country); } catch {} }

    return NextResponse.json({
      niche, country,
      trending: daily.slice(0, 12),
      risingQueries: related.rising.slice(0, 12),
      topQueries: related.top.slice(0, 12),
      products,
      youtube,
      youtubeEnabled: youtubeEnabled(),
      warnings,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
