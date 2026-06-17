// Build one-click research links that open in the CLIENT's own browser,
// pre-searched for the niche/keyword. No scraping — just deep links reviewed manually.
const enc = encodeURIComponent;
const slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function platformLinks(keyword, country = 'US') {
  const k = enc(keyword);
  const sl = slug(keyword);
  return [
    { name: 'Facebook Ads Library', url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${k}&search_type=keyword_unordered`, note: 'Active ads only — currently running' },
    { name: 'AliExpress', url: `https://www.aliexpress.com/w/wholesale-${sl}.html?SearchText=${k}`, note: 'Sort by orders for demand' },
    { name: 'Amazon', url: `https://www.amazon.com/s?k=${k}`, note: 'Best Sellers rank check' },
  ];
}
