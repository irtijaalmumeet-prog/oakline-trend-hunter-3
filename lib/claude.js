// Claude turns the niche + live trend signals into concrete product ideas.
import Anthropic from '@anthropic-ai/sdk';
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

function client() {
  if (!process.env.CLAUDE_API_KEY) throw new Error('CLAUDE_API_KEY is not set in .env.local');
  return new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
}

export async function suggestNiche(country) {
  const a = client();
  const m = await a.messages.create({ model: MODEL, max_tokens: 200, messages: [{ role: 'user',
    content: `Suggest ONE broad e-commerce/dropshipping niche with momentum in ${country}. JSON only: {"niche":string,"reason":string}` }] });
  return safeJson(text(m), { niche: 'home & kitchen gadgets', reason: 'default' });
}

/** Generate scored product ideas from niche + live trend terms. */
export async function productIdeas({ niche, country, trendTerms = [] }) {
  const a = client();
  const m = await a.messages.create({
    model: MODEL, max_tokens: 1400,
    system: 'You are a dropshipping product researcher. Given a niche and live trending search terms, propose specific, currently-relevant physical products worth researching. Be concrete and realistic.',
    messages: [{ role: 'user', content:
      `Niche: "${niche}". Country: ${country}.\n` +
      `Live trending search terms right now: ${trendTerms.slice(0, 25).join(', ') || '(none)'}.\n` +
      `Propose up to 10 product ideas. JSON only:\n` +
      `{"products":[{"name":string,"whyNow":string,"audience":string,"demandScore":number,"competitionScore":number}]}\n` +
      `demandScore and competitionScore are 0-100. Favour products connected to the trending terms.` }],
  });
  const parsed = safeJson(text(m), { products: [] });
  return parsed.products || [];
}

function text(msg){ return (msg.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n'); }
function safeJson(t, fb){ try{ const x=t.match(/\{[\s\S]*\}/); return x?JSON.parse(x[0]):fb; }catch{ return fb; } }
