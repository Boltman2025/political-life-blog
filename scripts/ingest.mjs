import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";
import * as cheerio from "cheerio";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "political-life-blog-bot/1.0" },
});

// ============================
// 1) إعدادات من ENV
// ============================
const RSS_FEEDS = String(process.env.RSS_FEEDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || "5");
const MAX_TOTAL_NEW = Number(process.env.MAX_TOTAL_NEW || "8");

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");

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

function pickDate(item) {
  const d = item.isoDate || item.pubDate || item.published || "";
  const parsed = d ? new Date(d) : new Date();
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function makeId(item, idx) {
  const base = item.link || item.guid || item.id || item.title || "";
  const hash = Buffer.from(base).toString("base64").slice(0, 16);
  return `${Date.now()}_${idx}_${hash}`;
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

// ✅ صور fallback ثابتة (غير عشوائية)
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1524499982521-1ffd58dd89ea?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1450101215322-bf5cd27642fc?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=70",
];

function fallbackImage(seed = "") {
  const n = Math.abs(
    Array.from(String(seed)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  );
  return FALLBACK_IMAGES[n % FALLBACK_IMAGES.length];
}

// ✅ استخراج صورة من RSS item
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

// ✅ استخراج og:image / twitter:image من صفحة الخبر
async function extractOgImageFromUrl(url) {
  try {
    if (!url || !String(url).startsWith("http")) return "";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    clearTimeout(timer);
    if (!res.ok) return "";

    const html = await res.text();
    const $ = cheerio.load(html);

    const og = $('meta[property="og:image"]').attr("content");
    if (og && String(og).startsWith("http")) return String(og);

    const tw = $('meta[name="twitter:image"]').attr("content");
    if (tw && String(tw).startsWith("http")) return String(tw);

    return "";
  } catch {
    return "";
  }
}

// ✅ ترتيب المصادر: Google News أولاً
function feedPriority(url = "") {
  const u = String(url).toLowerCase();
  if (u.includes("news.google.com")) return 0;
  if (u.includes("apn.dz")) return 1;
  return 2;
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
  const collected = [];

  const orderedFeeds = [...RSS_FEEDS].sort((a, b) => feedPriority(a) - feedPriority(b));

  for (const feedUrl of orderedFeeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const feedTitle = safeText(feed.title) || feedUrl;

      const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];

        const sourceUrl = it.link || it.guid || "";
        if (!sourceUrl) continue;

        const meta = detectCategory(sourceUrl);

        const title = safeText(it.title);
        const excerpt = safeText(it.contentSnippet || it.summary).slice(0, 220);
        const content = safeText(it.contentSnippet || it.summary || it.content);

        if (!title) continue;

        // صورة
        let imageUrl = extractImageFromItem(it);
        if (!imageUrl) imageUrl = await extractOgImageFromUrl(sourceUrl);
        if (!imageUrl) imageUrl = fallbackImage(sourceUrl);

        collected.push({
          id: makeId(it, i),
          title,
          excerpt: excerpt || content.slice(0, 220),
          content: content || excerpt,
          category: meta.category,
          author: safeText(it.creator || it.author || feedTitle || "مصدر"),
          date: pickDate(it),
          imageUrl,
          sourceUrl,
          isBreaking: false,
          editorialStyle: meta.style,
          feedSource: feedUrl,
        });
      }
    } catch (e) {
      console.log("Failed feed:", feedUrl);
      console.log(String(e?.message || e));
    }
  }

  const newOnes = collected.slice(0, MAX_TOTAL_NEW);
  const merged = dedupeBySourceUrl([...newOnes, ...existing]).slice(0, 200);

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  console.log("✅ Wrote articles:", merged.length);
  console.log("✅ New fetched:", newOnes.length);
  console.log("✅ Output:", OUT_FILE);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
