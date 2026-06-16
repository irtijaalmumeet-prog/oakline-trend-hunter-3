// Build one-click research links that open in the CLIENT's own browser,
// pre-searched for the niche/keyword. No scraping — just deep links the user
// reviews manually. This is the legal way to use Facebook/TikTok ad libraries.
const enc = encodeURIComponent;

export function platformLinks(keyword, country = 'US') {
  const k = enc(keyword);
  return [
    { name: 'Facebook Ads Library', url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${k}&search_type=keyword_unordered`, note: 'Active ads only — currently running' },
    { name: 'TikTok Creative Center', url: `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?keyword=${k}&region=${country}&period=30`, note: 'Active / currently-running top ads' },
    { name: 'TikTok Shop', url: `https://www.tiktok.com/search?q=${k}`, note: 'Search products/videos' },
    { name: 'AliExpress', url: `https://www.aliexpress.com/wholesale?SearchText=${k}`, note: 'Sort by orders for demand' },
    { name: 'CJ Dropshipping', url: `https://cjdropshipping.com/search?q=${k}`, note: 'Supplier & price check' },
    { name: 'Amazon', url: `https://www.amazon.com/s?k=${k}`, note: 'Best Sellers rank check' },
  ];
}
