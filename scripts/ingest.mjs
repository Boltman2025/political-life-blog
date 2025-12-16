import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "political-life-blog-bot/1.3" },
});

/* ============================
   1) ENV
============================ */
const RSS_FEEDS = String(process.env.RSS_FEEDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || "7");
const MAX_TOTAL_NEW = Number(process.env.MAX_TOTAL_NEW || "12");
const HOURS_BACK = Number(process.env.HOURS_BACK || "36");
const MAX_STORE = Number(process.env.MAX_STORE || "40");

const APN_CAP_IN_NEW = 2;
const APN_HARD_CAP_TOTAL = 4;

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");
const STAMP_FILE = path.join(process.cwd(), "public", "_ingest_stamp.json");
const LOCAL_RSS_DIR = path.join(process.cwd(), "public", "rss");

/* ============================
   2) Keywords
============================ */
const DZ_KEYWORDS = [
  "الجزائر","جزائري","الجزائري","رئيس الجمهورية","الرئيس","تبون",
  "الحكومة","وزارة","البرلمان","المجلس الشعبي","مجلس الأمة",
  "الدستور","الانتخابات","الولاة","ولاية","الجيش","الأمن",
];

/* ============================
   3) Utils
============================ */
const safeText = (x) => String(x || "").replace(/\s+/g, " ").trim();

function parseDateMaybe(item) {
  const d = item.isoDate || item.pubDate || item.published || item.date || "";
  const dt = d ? new Date(d) : null;
  return dt && !isNaN(dt.getTime()) ? dt : null;
}

const toISO = (dt) => (dt && !isNaN(dt.getTime()) ? dt.toISOString() : "");

const isRecent = (dt) =>
  dt && Date.now() - dt.getTime() <= HOURS_BACK * 3600 * 1000;

function makeStableId(item, idx) {
  const base = item.link || item.guid || item.title || String(idx);
  return (
    "a_" +
    Buffer.from(String(base)).toString("base64").replace(/=+/g, "").slice(0, 20)
  );
}

function dedupeBySourceUrl(arr) {
  const seen = new Set();
  return arr.filter((a) => {
    const k = a.sourceUrl;
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function readExisting() {
  try {
    return JSON.parse(await fs.readFile(OUT_FILE, "utf-8")) || [];
  } catch {
    return [];
  }
}

/* ============================
   4) Source helpers
============================ */
const isAPNUrl = (u = "") => u.toLowerCase().includes("apn.dz");

function sourceTier(feedUrl = "") {
  const f = feedUrl.toLowerCase();
  if (f.startsWith("local:") || f.includes(".dz")) return "dz";
  if (f.includes("news.google.com")) return "backfill";
  return "global";
}

/* ============================
   5) Scoring (FIXED)
============================ */
function dzScore(a) {
  // ✅ أولوية مطلقة للمحلي
  if (a.__local) return 1000;

  let s = 0;
  if (a.sourceTier === "dz") s += 55;
  if (a.sourceTier === "backfill") s += 20;

  const text = `${a.title} ${a.excerpt}`.toLowerCase();
  DZ_KEYWORDS.forEach((k) => {
    if (text.includes(k)) s += 5;
  });

  if (isAPNUrl(a.sourceUrl)) s -= 20;
  return s;
}

const sortDzThenNewest = (arr) =>
  [...arr].sort((a, b) => {
    const d = dzScore(b) - dzScore(a);
    if (d !== 0) return d;
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

/* ============================
   6) Ingest Remote RSS
============================ */
async function ingestRemoteFeeds() {
  const out = [];
  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const it of (feed.items || []).slice(0, MAX_ITEMS_PER_FEED)) {
        const dt = parseDateMaybe(it);
        if (!isRecent(dt)) continue;
        out.push({
          id: makeStableId(it),
          title: safeText(it.title),
          excerpt: safeText(it.contentSnippet),
          date: toISO(dt),
          sourceUrl: it.link || "",
          sourceTier: sourceTier(feedUrl),
          __local: false,
        });
      }
    } catch {}
  }
  return out;
}

/* ============================
   7) Ingest Local RSS
============================ */
async function ingestLocalRssDir() {
  try {
    const files = (await fs.readdir(LOCAL_RSS_DIR)).filter((f) =>
      f.endsWith(".xml")
    );
    const out = [];
    for (const f of files) {
      const xml = await fs.readFile(path.join(LOCAL_RSS_DIR, f), "utf-8");
      const feed = await parser.parseString(xml);
      for (const it of (feed.items || []).slice(0, MAX_ITEMS_PER_FEED)) {
        const dt = parseDateMaybe(it) || new Date();
        if (!isRecent(dt)) continue;
        out.push({
          id: makeStableId(it),
          title: safeText(it.title),
          excerpt: "",
          date: toISO(dt),
          sourceUrl: it.link || "",
          sourceTier: "dz",
          __local: true,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/* ============================
   8) MAIN
============================ */
async function main() {
  const existing = await readExisting();
  const local = await ingestLocalRssDir();
  const remote = await ingestRemoteFeeds();

  const collected = dedupeBySourceUrl([...local, ...remote]);
  const sorted = sortDzThenNewest(collected);

  const picked = [];
  let apnCount = 0;

  for (const a of sorted) {
    if (picked.length >= MAX_TOTAL_NEW) break;
    if (isAPNUrl(a.sourceUrl) && apnCount++ >= APN_CAP_IN_NEW) continue;
    picked.push(a);
  }

  let merged = sortDzThenNewest(
    dedupeBySourceUrl([...picked, ...existing])
  ).slice(0, MAX_STORE);

  merged = merged.map(({ __local, ...rest }) => rest);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2));

  await fs.writeFile(
    STAMP_FILE,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        fetchedLocal: local.length,
        fetchedRemote: remote.length,
        wrote: merged.length,
      },
      null,
      2
    )
  );

  console.log("✅ DONE:", {
    local: local.length,
    remote: remote.length,
    wrote: merged.length,
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
