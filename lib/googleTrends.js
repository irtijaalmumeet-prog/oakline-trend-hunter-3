// Google Trends client — REAL, free, no API key. Runs from your server.
// Uses the public dailytrends + relatedqueries endpoints. Google prefixes
// responses with ")]}'," which we strip before JSON.parse.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

function stripPrefix(text) {
  return text.replace(/^\)\]\}'?,?\s*/, '');
}

/** Trending searches right now for a country (changes daily, country-specific). */
export async function dailyTrends(geo = 'US') {
  const url = `https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=0&geo=${encodeURIComponent(geo)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('Google Trends daily error ' + res.status);
  const data = JSON.parse(stripPrefix(await res.text()));
  const days = data.default?.trendingSearchesDays || [];
  const items = [];
  for (const d of days) {
    for (const t of (d.trendingSearches || [])) {
      items.push({
        query: t.title?.query,
        traffic: t.formattedTraffic || '',
        related: (t.relatedQueries || []).map((r) => r.query),
        articleTitle: t.articles?.[0]?.title || '',
      });
    }
  }
  return items;
}

/**
 * Interest + rising/related queries for a specific niche keyword in a country.
 * Two-step token flow that Google Trends requires.
 */
export async function relatedQueries(keyword, geo = 'US') {
  const exploreUrl = 'https://trends.google.com/trends/api/explore?hl=en-US&tz=0';
  const reqObj = {
    comparisonItem: [{ keyword, geo, time: 'today 3-m' }],
    category: 0,
    property: '',
  };
  const eRes = await fetch(
    `${exploreUrl}&req=${encodeURIComponent(JSON.stringify(reqObj))}`,
    { headers: { 'User-Agent': UA } }
  );
  if (!eRes.ok) throw new Error('Trends explore error ' + eRes.status);
  const eData = JSON.parse(stripPrefix(await eRes.text()));
  const widget = (eData.widgets || []).find((w) => w.id === 'RELATED_QUERIES');
  if (!widget) return { rising: [], top: [] };

  const rReq = { restriction: widget.request.restriction, keywordType: 'QUERY',
    metric: ['TOP', 'RISING'], trendinessSettings: widget.request.trendinessSettings,
    requestOptions: widget.request.requestOptions, language: 'en' };
  const url = `https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(rReq))}&token=${encodeURIComponent(widget.token)}`;
  const dRes = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!dRes.ok) throw new Error('Trends related error ' + dRes.status);
  const dData = JSON.parse(stripPrefix(await dRes.text()));
  const ranked = dData.default?.rankedList || [];
  const pick = (i) => (ranked[i]?.rankedKeyword || []).map((k) => ({ query: k.query, value: k.value }));
  return { top: pick(0), rising: pick(1) };
}
