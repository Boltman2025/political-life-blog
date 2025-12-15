import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "political-life-blog-bot/1.0" },
});

// ============================
// 1) إعدادات من الـ ENV
// ============================
const RSS_FEEDS = String(process.env.RSS_FEEDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || "5");
const MAX_TOTAL_NEW = Number(process.env.MAX_TOTAL_NEW || "8");
const HOURS_BACK = Number(process.env.HOURS_BACK || "36");

// ملف الإخراج
const OUT_FILE = path.join(process.cwd(), "public", "articles.json");

// ✅ نحدد أولويات (سبق برس أولاً)
const FEED_PRIORITY = [
  "sabqpress.dz", // ✅ الأول
  "news.google.com",
  "apn.dz",
  "aps.dz",
  "el-mouradia.dz",
  "mdn.dz",
  "france24.com",
  "bbci.co.uk",
];

// ============================
// 2) تصنيف + أسلوب حسب المصدر
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
    url.includes("sabqpress.dz") ||
    url.includes("awras.com") ||
    url.includes("dznews.dz") ||
    url.includes("al24news.dz") ||
    url.includes("elkhabar.com") ||
    url.includes("echoroukonline.com") ||
    url.includes("ennaharonline.com") ||
    url.includes("elbilad.net") ||
    url.includes("algerie360.com") ||
    url.includes("tsa-algerie.com") ||
    url.includes("elbinaawatani.com") ||
    url.includes("fln.dz") ||
    url.includes("rnd.dz") ||
    url.includes("ffs.dz") ||
    url.includes("rcd-algerie.net") ||
    url.includes("pt.dz")
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
// 3) أدوات مساعدة
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
  if (!dt) return false; // ✅ بدون تاريخ = نعتبره غير موثوق (لتفادي أخبار قديمة)
  const msBack = hoursBack * 60 * 60 * 1000;
  return Date.now() - dt.getTime() <= msBack;
}

function makeStableId(item, idx) {
  const base = item.link || item.guid || item.id || item.title || String(idx);
  const hash = Buffer.from(String(base)).toString("base64").slice(0, 20);
  return `a_${hash}`;
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

// ✅ صور افتراضية “سياسية/أخبار” بدل العشوائية
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1524499982521-1ffd58dd89ea?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1450101215322-bf5cd27642fc?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=70",
];

function fallbackImage() {
  return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
}

// ✅ استخراج صورة حقيقية من RSS (media:thumbnail / enclosure / HTML)
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

// ✅ نقرأ الرسمي إن وجد (اختياري)
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

// ترتيب الفيدز حسب الأولوية
function sortFeedsByPriority(feeds) {
  const score = (u) => {
    const url = String(u).toLowerCase();
    const idx = FEED_PRIORITY.findIndex((k) => url.includes(k));
    return idx === -1 ? 999 : idx;
  };
  return [...feeds].sort((a, b) => score(a) - score(b));
}

// ============================
// 4) التنفيذ
// ============================
async function main() {
  if (!RSS_FEEDS.length) {
    console.log("RSS_FEEDS is empty. Nothing to ingest.");
    return;
  }

  const existing = await readExisting();
  const official = await readOfficial();

  const collected = [];
  const feedsSorted = sortFeedsByPriority(RSS_FEEDS);

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

        // ✅ فلتر آخر HOURS_BACK ساعة
        const dt = parseDateMaybe(it);
        if (!isRecent(dt, HOURS_BACK)) continue;

        const meta = detectCategory(sourceUrl);

        const excerpt = safeText(it.contentSnippet || it.summary).slice(0, 220);
        const content = safeText(it.contentSnippet || it.summary || it.content || "");

        const realImg = extractImageFromItem(it);
        const imageUrl = realImg || fallbackImage();

        collected.push({
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

  // ✅ نحافظ على الأفضلية: الرسمي أولاً، ثم الجديد (المفلتر)، ثم القديم
  const newOnes = collected.slice(0, MAX_TOTAL_NEW);
 const merged = dedupeBySourceUrl([...official, ...newOnes, ...existing]).slice(0, 40);
 await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  console.log("✅ HOURS_BACK:", HOURS_BACK);
  console.log("✅ Wrote articles:", merged.length);
  console.log("✅ New fetched:", newOnes.length);
  console.log("✅ Output:", OUT_FILE);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
