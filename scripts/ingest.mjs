import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "political-life-blog-bot/1.0" },
});

const RSS_FEEDS = String(process.env.RSS_FEEDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || "7");
const MAX_TOTAL_NEW = Number(process.env.MAX_TOTAL_NEW || "12");
const HOURS_BACK = Number(process.env.HOURS_BACK || "36");
const MAX_STORE = Number(process.env.MAX_STORE || "40");

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");
const STAMP_FILE = path.join(process.cwd(), "public", "_ingest_stamp.json");

// ✅ كلمات تعطي أولوية “الجزائر”
// (نستخدمها لترتيب الأخبار: الجزائري أولاً ثم غيره)
const DZ_KEYWORDS = [
  "الجزائر",
  "جزائري",
  "الجزائري",
  "الرئيس",
  "رئيس الجمهورية",
  "الحكومة",
  "البرلمان",
  "المجلس الشعبي",
  "مجلس الأمة",
  "وزارة",
  "الداخلية",
  "الخارجية",
  "الجيش",
  "الدرك",
  "الأمن",
  "ولاة",
  "ولاية",
  "العاصمة",
  "الجزائر العاصمة",
  "الانتخابات",
];

// ✅ domains: ما نعتبره “جزائري/محلي”
const DZ_DOMAINS = ["awras.com", "apn.dz"];

// Google backfill
const BACKFILL_DOMAINS = ["news.google.com"];

// أدوات مساعدة
function safeText(x) {
  return String(x || "").replace(/\s+/g, " ").trim();
}

function parseDateMaybe(item) {
  const d = item.isoDate || item.pubDate || item.published || item.date || "";
  const dt = d ? new Date(d) : null;
  return dt && !isNaN(dt.getTime()) ? dt : null;
}

function isRecent(dt, hoursBack) {
  if (!dt) return false;
  const msBack = hoursBack * 60 * 60 * 1000;
  return Date.now() - dt.getTime() <= msBack;
}

function toISO(dt) {
  return dt && !isNaN(dt.getTime()) ? dt.toISOString() : "";
}

function makeStableId(item, idx) {
  const base = item.link || item.guid || item.id || item.title || String(idx);
  const hash = Buffer.from(String(base)).toString("base64").replace(/=+/g, "").slice(0, 20);
  return `a_${hash}`;
}

function domainTier(url = "") {
  const u = String(url).toLowerCase();
  if (BACKFILL_DOMAINS.some((d) => u.includes(d))) return "backfill";
  if (DZ_DOMAINS.some((d) => u.includes(d))) return "dz";
  return "global";
}

function dedupeBySourceUrl(arr) {
  const seen = new Set();
  const out = [];
  for (const a of arr) {
    const key = String(a.sourceUrl || a.title || "").trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
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

// ✅ score “جزائري” أعلى
function dzScore(article) {
  const text = `${article.title || ""} ${article.excerpt || ""} ${article.content || ""}`.toLowerCase();
  let s = 0;

  // domain جزائري يعطي دفعة قوية
  if (article.sourceTier === "dz") s += 50;

  // كلمات مفتاحية تزيد النقاط
  for (const k of DZ_KEYWORDS) {
    if (text.includes(k.toLowerCase())) s += 5;
  }

  return s;
}

// ✅ ترتيب: (1) جزائري أولاً حسب score، ثم (2) الأحدث
function sortDzThenNewest(arr) {
  return [...arr].sort((a, b) => {
    const sa = dzScore(a);
    const sb = dzScore(b);
    if (sb !== sa) return sb - sa;

    const ta = a?.date ? new Date(a.date).getTime() : 0;
    const tb = b?.date ? new Date(b.date).getTime() : 0;
    if (tb !== ta) return tb - ta;

    return String(b.title || "").localeCompare(String(a.title || ""));
  });
}

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

function detectCategory(sourceUrl = "") {
  const url = String(sourceUrl).toLowerCase();

  if (url.includes("apn.dz") || url.includes("mdn.dz") || url.includes("el-mouradia.dz")) {
    return { category: "رسمي", style: "أسلوب خبري رسمي محايد دون رأي." };
  }
  if (url.includes("awras.com")) {
    return { category: "شأن جزائري", style: "أسلوب تفسيري دون انحياز." };
  }
  if (url.includes("news.google.com")) {
    return { category: "مختارات", style: "تلخيص سريع دون تهويل." };
  }
  return { category: "دولي", style: "أسلوب خبري هادئ." };
}

async function ingestFeeds(feeds) {
  const out = [];
  for (const feedUrl of feeds) {
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
        const imageUrl = extractImageFromItem(it) || fallbackImage();

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
          sourceTier: domainTier(feedUrl), // dz / global / backfill
        });
      }
    } catch (e) {
      console.log("Failed feed:", feedUrl);
      console.log(String(e?.message || e));
    }
  }
  return out;
}

async function main() {
  if (!RSS_FEEDS.length) {
    console.log("RSS_FEEDS is empty. Nothing to ingest.");
    return;
  }

  const existing = await readExisting();

  const collected = await ingestFeeds(RSS_FEEDS);
  const collectedSorted = sortDzThenNewest(collected);

  // ✅ نضمن “جزائري” يملأ أولاً داخل الـ12
  const dzFirst = collectedSorted.filter((x) => dzScore(x) >= 10).slice(0, MAX_TOTAL_NEW);
  const remaining = Math.max(0, MAX_TOTAL_NEW - dzFirst.length);

  const fillOthers = collectedSorted
    .filter((x) => !dzFirst.some((y) => y.sourceUrl === x.sourceUrl))
    .slice(0, remaining);

  const newOnes = [...dzFirst, ...fillOthers];

  // ✅ دمج ثم ترتيب نهائي “جزائري ثم الأحدث” ثم حفظ 40 فقط
  const merged = sortDzThenNewest(dedupeBySourceUrl([...newOnes, ...existing])).slice(0, MAX_STORE);

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  const stamp = {
    ranAt: new Date().toISOString(),
    hoursBack: HOURS_BACK,
    maxStore: MAX_STORE,
    maxTotalNew: MAX_TOTAL_NEW,
    feeds: RSS_FEEDS,
    fetched: collected.length,
    wrote: merged.length,
    topTitles: merged.slice(0, 6).map((x) => x.title),
    topDates: merged.slice(0, 6).map((x) => x.date),
  };
  await fs.writeFile(STAMP_FILE, JSON.stringify(stamp, null, 2), "utf-8");

  console.log("✅ HOURS_BACK:", HOURS_BACK);
  console.log("✅ Fetched total:", collected.length);
  console.log("✅ Wrote articles:", merged.length);
  console.log("✅ Output:", OUT_FILE);
  console.log("✅ Stamp:", STAMP_FILE);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
