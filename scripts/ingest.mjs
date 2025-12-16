import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 25000,
  headers: { "User-Agent": "political-life-blog-bot/1.0" },
});

// ============================
// ENV
// ============================
const RSS_FEEDS = String(process.env.RSS_FEEDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || "7");
const MAX_TOTAL_NEW = Number(process.env.MAX_TOTAL_NEW || "12");
const HOURS_BACK = Number(process.env.HOURS_BACK || "36");

// ✅ تخزين دائم: 40 فقط
const STORAGE_LIMIT = 40;

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");

// ✅ ترتيب أولوية المصادر (الأعلى أولاً)
const PRIORITY = [
  "awras.com",
  "apn.dz",
  "aps.dz",
  "el-mouradia.dz",
  "mdn.dz",
  "majliselouma.dz",
  "cour-constitutionnelle.dz",
  "mrp.gov.dz",
  "bbci.co.uk",
  "france24.com",
  "news.google.com",
];

// ============================
// Category + style
// ============================
function detectCategory(sourceUrl = "") {
  const url = String(sourceUrl).toLowerCase();

  if (
    url.includes("aps.dz") ||
    url.includes("apn.dz") ||
    url.includes("mdn.dz") ||
    url.includes("el-mouradia.dz") ||
    url.includes("majliselouma.dz") ||
    url.includes("cour-constitutionnelle.dz") ||
    url.includes("mrp.gov.dz")
  ) {
    return {
      category: "رسمي",
      style: "أسلوب خبري رسمي محايد دون رأي، مع تلخيص واضح وذكر الوقائع فقط.",
    };
  }

  if (
    url.includes("awras.com") ||
    url.includes("elkhabar.com") ||
    url.includes("echoroukonline.com") ||
    url.includes("ennaharonline.com") ||
    url.includes("elbilad.net") ||
    url.includes("algerie360.com") ||
    url.includes("tsa-algerie.com")
  ) {
    return {
      category: "مواقف سياسية",
      style:
        "أسلوب تفسيري: يوضح من قال ماذا ولماذا، مع وضع التصريحات في سياقها دون انحياز أو مبالغة.",
    };
  }

  return {
    category: "قراءة سياسية",
    style:
      "أسلوب تحليلي صحفي: يربط الحدث بالسياق السياسي الجزائري بهدوء، ويقدم 3 نقاط قراءة سريعة دون إطلاق أحكام قاطعة.",
  };
}

// ============================
// Helpers
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
  return dt && !isNaN(dt.getTime()) ? dt.toISOString() : "";
}

function isRecent(dt, hoursBack) {
  if (!dt) return false; // ✅ بدون تاريخ = مرفوض (يمنع تسلل القديم)
  const msBack = hoursBack * 60 * 60 * 1000;
  return Date.now() - dt.getTime() <= msBack;
}

function makeStableId(item, idx) {
  const base = item.link || item.guid || item.id || item.title || String(idx);
  const hash = Buffer.from(String(base)).toString("base64").replace(/=+$/g, "").slice(0, 22);
  return `a_${hash}`;
}

function getPriorityScore(url) {
  const u = String(url || "").toLowerCase();
  const idx = PRIORITY.findIndex((k) => u.includes(k));
  return idx === -1 ? 999 : idx;
}

function sortByPriorityThenDateDesc(a, b) {
  const pa = getPriorityScore(a.sourceUrl);
  const pb = getPriorityScore(b.sourceUrl);
  if (pa !== pb) return pa - pb;

  const da = a.date ? new Date(a.date).getTime() : 0;
  const db = b.date ? new Date(b.date).getTime() : 0;
  return db - da;
}

function dedupeBySourceUrl(arr) {
  const seen = new Set();
  const out = [];
  for (const a of arr) {
    const key = String(a.sourceUrl || "").trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

// صور افتراضية
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1524499982521-1ffd58dd89ea?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1450101215322-bf5cd27642fc?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=70",
];

function fallbackImage() {
  return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
}

function extractImageFromItem(it) {
  const mediaThumb =
    it?.["media:thumbnail"]?.url ||
    it?.["media:thumbnail"]?.["$"]?.url ||
    it?.enclosure?.url;

  if (mediaThumb && String(mediaThumb).startsWith("http")) return String(mediaThumb);

  if (Array.isArray(it?.enclosures) && it.enclosures.length) {
    const img = it.enclosures.find((e) => String(e?.type || "").startsWith("image/"));
    if (img?.url && String(img.url).startsWith("http")) return String(img.url);
  }

  const html = String(it?.content || it?.["content:encoded"] || "");
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match?.[1] && String(match[1]).startsWith("http")) return String(match[1]);

  return "";
}

async function readExisting() {
  try {
    const raw = await fs.readFile(OUT_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function readOfficial() {
  try {
    const p = path.join(process.cwd(), "public", "official.json");
    const raw = await fs.readFile(p, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ============================
// Ingest
// ============================
async function ingestAll(feeds) {
  const out = [];

  // ترتيب الفيدز حسب الأولوية
  const feedsSorted = [...feeds].sort((a, b) => getPriorityScore(a) - getPriorityScore(b));
  console.log("✅ Feeds order:", feedsSorted);

  for (const feedUrl of feedsSorted) {
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

        const meta = detectCategory(sourceUrl);
        const excerpt = safeText(it.contentSnippet || it.summary).slice(0, 220);
        const content = safeText(it.contentSnippet || it.summary || it.content || "");
        const realImg = extractImageFromItem(it);
        const imageUrl = realImg || fallbackImage();

        out.push({
          id: makeStableId(it, i),
          title,
          excerpt: excerpt || content.slice(0, 220),
          content: content || excerpt,
          category: meta.category,
          author: safeText(it.creator || it.author || feedTitle || "مصدر"),
          date: toISO(dt),
          imageUrl,
          sourceUrl,
          isBreaking: false,
          editorialStyle: meta.style,
        });
      }
    } catch (e) {
      console.log("Failed feed:", feedUrl);
      console.log(String(e?.message || e));
    }
  }

  return out;
}

function filterRecentArticles(arr) {
  return arr.filter((a) => {
    const dt = a?.date ? new Date(a.date) : null;
    return dt && !isNaN(dt.getTime()) && isRecent(dt, HOURS_BACK);
  });
}

async function main() {
  if (!RSS_FEEDS.length) {
    console.log("RSS_FEEDS is empty. Nothing to ingest.");
    return;
  }

  const existingRaw = await readExisting();
  const officialRaw = await readOfficial();

  // ✅ الأهم: تنظيف القديم الموجود بالفعل (هذا كان سبب بقاء أخبار قديمة)
  const existing = filterRecentArticles(existingRaw);
  const official = filterRecentArticles(officialRaw);

  const collected = await ingestAll(RSS_FEEDS);

  // ✅ حد جديد: 12 فقط في كل تشغيل
  const newOnes = collected
    .sort(sortByPriorityThenDateDesc)
    .slice(0, MAX_TOTAL_NEW);

  // ✅ دمج + Dedup + ترتيب + قص 40
  const merged = dedupeBySourceUrl([...official, ...newOnes, ...existing])
    .sort(sortByPriorityThenDateDesc)
    .slice(0, STORAGE_LIMIT);

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  console.log("✅ HOURS_BACK:", HOURS_BACK);
  console.log("✅ Existing kept (recent only):", existing.length);
  console.log("✅ Official kept (recent only):", official.length);
  console.log("✅ New fetched:", newOnes.length);
  console.log("✅ Wrote articles:", merged.length);
  console.log("✅ Output:", OUT_FILE);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
