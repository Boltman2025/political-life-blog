import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 25000,
  headers: { "User-Agent": "political-life-blog-bot/1.0" },
});

// ============================
// 1) ENV
// ============================
const RSS_FEEDS = String(process.env.RSS_FEEDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || "7");
const MAX_TOTAL_NEW = Number(process.env.MAX_TOTAL_NEW || "12");
const HOURS_BACK = Number(process.env.HOURS_BACK || "36");

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");

// ============================
// 2) Helpers
// ============================
function safeText(x) {
  return String(x || "").replace(/\s+/g, " ").trim();
}

function parseDateMaybe(item) {
  const d = item.isoDate || item.pubDate || item.published || item.date || "";
  const dt = d ? new Date(d) : null;
  return dt && !isNaN(dt.getTime()) ? dt : null;
}

function toISO(dt) {
  return dt && !isNaN(dt.getTime()) ? dt.toISOString() : new Date().toISOString();
}

function isRecent(dt, hoursBack) {
  if (!dt) return false;
  const msBack = hoursBack * 60 * 60 * 1000;
  return Date.now() - dt.getTime() <= msBack;
}

function makeStableId(item, idx) {
  const base = item.link || item.guid || item.id || item.title || String(idx);
  const hash = Buffer.from(String(base)).toString("base64").slice(0, 20);
  return `a_${hash}`;
}

// ============================
// 3) تصنيف المصدر
// ============================
function detectCategory(sourceUrl = "") {
  const url = sourceUrl.toLowerCase();

  if (
    url.includes("aps.dz") ||
    url.includes("apn.dz") ||
    url.includes("el-mouradia.dz") ||
    url.includes("mdn.dz")
  ) {
    return {
      category: "رسمي",
      style: "أسلوب خبري رسمي محايد دون رأي.",
    };
  }

  if (
    url.includes("sabqpress.dz") ||
    url.includes("awras.com")
  ) {
    return {
      category: "مواقف سياسية",
      style: "أسلوب تفسيري صحفي.",
    };
  }

  return {
    category: "قراءة سياسية",
    style: "أسلوب تحليلي هادئ.",
  };
}

// ============================
// 4) Primary / Backfill (الحل 1)
// ============================
function sourceTier(itemLink = "", feedUrl = "") {
  const u = `${itemLink} ${feedUrl}`.toLowerCase();

  // ✅ SabqPress عبر Google News = PRIMARY
  if (u.includes("news.google.com") && u.includes("sabqpress.dz")) {
    return "primary";
  }

  // Google News عادي = Backfill
  if (u.includes("news.google.com")) {
    return "backfill";
  }

  // مصادر مباشرة أخرى
  if (
    u.includes("awras.com") ||
    u.includes("apn.dz") ||
    u.includes("bbc.co.uk") ||
    u.includes("france24.com")
  ) {
    return "primary";
  }

  return "backfill";
}

// ============================
// 5) Dedup قوي
// ============================
function normalizeTitle(t = "") {
  return String(t)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeStrong(arr) {
  const seenTitle = new Set();
  const out = [];

  for (const a of arr) {
    const key = normalizeTitle(a.title);
    if (!key) continue;
    if (seenTitle.has(key)) continue;
    seenTitle.add(key);
    out.push(a);
  }
  return out;
}

// ============================
// 6) Images
// ============================
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1524499982521-1ffd58dd89ea?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=70",
];

function extractImageFromItem(it) {
  return (
    it?.enclosure?.url ||
    it?.["media:thumbnail"]?.url ||
    FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)]
  );
}

// ============================
// 7) Read existing
// ============================
async function readExisting() {
  try {
    const raw = await fs.readFile(OUT_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ============================
// 8) MAIN
// ============================
async function main() {
  const existing = await readExisting();
  const collected = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const feedTitle = safeText(feed.title) || feedUrl;

      const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const title = safeText(it.title);
        const sourceUrl = it.link || it.guid || "";

        if (!title || !sourceUrl) continue;

        const dt = parseDateMaybe(it);
        if (!isRecent(dt, HOURS_BACK)) continue;

        const tier = sourceTier(sourceUrl, feedUrl);
        const meta = detectCategory(sourceUrl);

        collected.push({
          id: makeStableId(it, i),
          title,
          excerpt: safeText(it.contentSnippet || it.summary).slice(0, 220),
          content: safeText(it.content || it.summary || ""),
          category: meta.category,
          author: safeText(it.creator || it.author || feedTitle),
          date: toISO(dt),
          imageUrl: extractImageFromItem(it),
          sourceUrl,
          isBreaking: false,
          editorialStyle: meta.style,
          sourceTier: tier,
        });
      }
    } catch (e) {
      console.log("❌ Feed failed:", feedUrl);
    }
  }

  // Primary أولًا ثم Backfill
  const primary = collected.filter((a) => a.sourceTier === "primary");
  const backfill = collected.filter((a) => a.sourceTier === "backfill");

  const primaryNew = primary.slice(0, MAX_TOTAL_NEW);
  const remaining = Math.max(0, MAX_TOTAL_NEW - primaryNew.length);
  const backfillNew = backfill.slice(0, remaining);

  const merged = dedupeStrong([
    ...primaryNew,
    ...backfillNew,
    ...existing,
  ]).slice(0, 200);

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  console.log("✅ New primary:", primaryNew.length);
  console.log("🟡 New backfill:", backfillNew.length);
  console.log("📦 Total written:", merged.length);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
