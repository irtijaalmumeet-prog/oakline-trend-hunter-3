// YouTube Data API (optional, free key). Returns demand signal per keyword.
export function youtubeEnabled() { return Boolean(process.env.YOUTUBE_API_KEY); }

export async function searchVideos(keyword, region = 'US', max = 5) {
  if (!youtubeEnabled()) return [];
  const key = process.env.YOUTUBE_API_KEY;
  const u = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=${max}&regionCode=${region}&q=${encodeURIComponent(keyword)}&key=${key}`;
  const res = await fetch(u);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((i) => ({ title: i.snippet?.title, channel: i.snippet?.channelTitle, videoId: i.id?.videoId }));
}
