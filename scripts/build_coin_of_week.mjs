// Build public/coin-of-the-week.json from the YouTube playlist RSS feed.
//
// WHY BUILD TIME, not the browser: the YouTube feed sends NO
// Access-Control-Allow-Origin header (verified 2026-07-23), so a client-side
// fetch from juntoclubco.com is blocked by CORS. Fetching here at build time and
// serving a same-origin JSON file avoids that — and still needs no API key, no
// Google Cloud project and no backend, which was the point of using RSS.
//
// The weekly ROTATION is still fully client-side and date-driven (see the
// coin-of-the-week script in public/index.html): no cron, no manual step. Only the
// playlist CONTENTS refresh, and they refresh on each site build/deploy.
//
// Order: the feed's entry order was verified against the live playlist page on
// 2026-07-23 and matched exactly, so walking down this list walks down the
// playlist. Re-check with --verify if the playlist is ever reordered.
//
// Usage: node scripts/build_coin_of_week.mjs [--verify]
import fs from "node:fs";

const PLAYLIST_ID = "PLV4_dWr8TB_8";
const FEED = `https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}`;
const OUT = "coin-of-the-week.json";
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36" };

const unescapeXml = (s) =>
  String(s)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, "&");

function parseFeed(xml) {
  const out = [];
  for (const block of xml.split("<entry>").slice(1)) {
    const id = (block.match(/<yt:videoId>([\w-]{6,20})<\/yt:videoId>/) || [])[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    if (id && title) out.push({ id, title: unescapeXml(title).trim() });
  }
  return out;
}

let videos = [];
try {
  const r = await fetch(FEED, { headers: UA });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  videos = parseFeed(await r.text());
  if (!videos.length) throw new Error("feed parsed to 0 entries");
} catch (e) {
  // NEVER clobber a good list with an empty one on a transient network failure —
  // a stale-but-valid playlist beats an empty page.
  if (fs.existsSync(OUT)) {
    console.warn(`coin-of-the-week: feed unavailable (${e.message}); keeping existing ${OUT}`);
    process.exit(0);
  }
  console.warn(`coin-of-the-week: feed unavailable (${e.message}); writing empty list — the page shows its placeholder`);
  fs.writeFileSync(OUT, JSON.stringify([]) + "\n");
  process.exit(0);
}

// Optional cross-check that the feed order still matches the live playlist order.
if (process.argv.includes("--verify")) {
  try {
    const html = await (await fetch(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`, { headers: UA })).text();
    const seen = [];
    for (const m of html.matchAll(/"videoId":"([\w-]{11})"/g)) if (!seen.includes(m[1])) seen.push(m[1]);
    const feedIds = videos.map((v) => v.id);
    const same = seen.length === feedIds.length && seen.every((id, i) => id === feedIds[i]);
    console.log(same
      ? `  ✓ feed order matches the live playlist order (${feedIds.length} videos)`
      : `  ⚠ ORDER MISMATCH — feed: ${feedIds.join(",")}\n                     playlist: ${seen.join(",")}`);
  } catch { console.log("  (order cross-check skipped — playlist page unreachable)"); }
}

fs.writeFileSync(OUT, JSON.stringify(videos, null, 2) + "\n");
console.log(`coin-of-the-week: wrote ${OUT} (${videos.length} videos)`);
videos.forEach((v, i) => console.log(`  ${String(i + 1).padStart(2)}. ${v.id}  ${v.title}`));
