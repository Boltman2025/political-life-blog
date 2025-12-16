import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 25000,
  headers: { "User-Agent": "political-life-blog-bot/1.0" },
});

// ============================
// 1) إعدادات ENV
// ============================
const RSS_FEEDS = String(process.env.RSS_FEEDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || "7");
const MAX_TOTAL_NEW = Number(process.env.MAX_TOTAL_NEW || "12");
const HOURS_BACK = Number(process.env.HOURS_BACK || "168"); // مؤقتًا

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");

// ============================
// 2) Primary / Backfill
// ============================
const PRIMARY_DOMAINS = [
  "sabqpress.dz",
  "awras.com",
  "aps.dz",
  "apn.dz",
  "el-mouradia.dz",
  "mdn.dz",
  "majliselouma.dz",
  "cour-constitutionnelle.dz",
  "mrp.gov.dz",
  "france24.com",
  "bbci.co.uk",
];

const BACKFILL_DOMAINS = ["news.google.com"];

// ============================
// 3) تصنيف + أسلوب
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
// 4) Helpers
// ============================
function safeText(x) {
  return String(x || "").replace(/\s+/g, " ").trim();
}

function toISO(dt) {
  return dt && !isNaN(dt.getTime()) ? dt.toISOString() : new Date().toISOString();
}

function parseDateMaybe(item) {
  const d = item.isoDate || item.pubDate || item.published || item.date || "";
  const dt = d ? new Date(d) : null;
  return dt && !isNaN(dt.getTime()) ? dt : null;
}

// ✅ محاولة استخراج تاريخ من النص/الرابط (Fallback)
function guessDateFromText(text = "") {
  const s = String(text);
  // 2025-12-16 أو 2025/12/16
  const m1 = s.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m1) {
    const y = Number(m1[1]);
    const mo = Number(m1[2]) - 1;
    const d = Number(m1[3]);
    const dt = new Date(Date.UTC(y, mo, d, 12, 0, 0));
    if (!isNaN(dt.getTime())) return dt;
  }

  // 16-12-2025 أو 16/12/2025
  const m2 = s.match(/(\d{1,2})[-/](\d{1,2})[-/](20\d{2})/);
  if (m2) {
    const d = Number(m2[1]);
    const mo = Number(m2[2]) - 1;
    const y = Number(m2[3]);
    const dt = new Date(Date.UTC(y, mo, d, 12, 0, 0));
    if (!isNaN(dt.getTime())) return dt;
  }

  return null;
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

// ✅ منع التكرار الحقيقي (Title + URL)
function normalizeTitle(t = "") {
  return String(t)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeStrong(arr) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];

  for (const a of arr) {
    const urlKey = String(a.sourceUrl || "").trim();
    const titleKey = normalizeTitle(a.title || "");
    if (!titleKey) continue;

    if (seenTitle.has(titleKey)) continue;
    if (urlKey && seenUrl.has(urlKey)) continue;

    seenTitle.add(titleKey);
    if (urlKey) seenUrl.add(urlKey);

    out.push(a);
  }
  return out;
}

// ✅ صور افتراضية
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

function domainTier(feedUrl) {
  const u = String(feedUrl).toLowerCase();
  if (BACKFILL_DOMAINS.some((d) => u.includes(d))) return "backfill";
  if (PRIMARY_DOMAINS.some((d) => u.includes(d))) return "primary";
  return "primary";
}

function splitFeeds(feeds) {
  const primary = [];
  const backfill = [];
  for (const f of feeds) {
    (domainTier(f) === "backfill" ? backfill : primary).push(f);
  }
  return { primary, backfill };
}

async function ingestFeeds(feeds, tierLabel) {
  const out = [];

  for (const feedUrl of feeds) {
    let kept = 0;
    let scanned = 0;

    try {
      const feed = await parser.parseURL(feedUrl);
      const feedTitle = safeText(feed.title) || feedUrl;

      const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

      for (let i = 0; i < items.length; i++) {
        scanned++;
        const it = items[i];

        const title = safeText(it.title);
        const sourceUrl = it.link || it.guid || "";
        if (!title || !sourceUrl) continue;

        // ✅ تاريخ: طبيعي -> وإذا فارغ نحاول نخمن
        let dt = parseDateMaybe(it);
        if (!dt) dt = guessDateFromText(sourceUrl) || guessDateFromText(title);

        // ✅ فلتر
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
          sourceTier: tierLabel,
        });

        kept++;
      }

      console.log(`✅ Feed OK: ${feedUrl}`);
      console.log(`   -> scanned=${scanned}, kept=${kept}, tier=${tierLabel}`);
    } catch (e) {
      console.log(`❌ Feed FAILED: ${feedUrl}`);
      console.log(String(e?.message || e));
      console.log(`   -> scanned=${scanned}, kept=${kept}, tier=${tierLabel}`);
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
  const official = await readOfficial();

  const { primary, backfill } = splitFeeds(RSS_FEEDS);

  console.log("✅ Primary feeds:", primary);
  console.log("🟡 Backfill feeds:", backfill);

  const primaryCollected = await ingestFeeds(primary, "primary");
  const backfillCollected = await ingestFeeds(backfill, "backfill");

  // Primary أولاً
  const primaryNew = primaryCollected.slice(0, MAX_TOTAL_NEW);
  const remaining = Math.max(0, MAX_TOTAL_NEW - primaryNew.length);
  const backfillNew = backfillCollected.slice(0, remaining);

  const newOnes = [...primaryNew, ...backfillNew];

  // official ثم الجديد ثم القديم + dedupe قوي
  const merged = dedupeStrong([...official, ...newOnes, ...existing]).slice(0, 200);

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  console.log("✅ HOURS_BACK:", HOURS_BACK);
  console.log("✅ Existing before:", existing.length);
  console.log("✅ New fetched (primary):", primaryNew.length);
  console.log("✅ New fetched (backfill):", backfillNew.length);
  console.log("✅ Wrote articles:", merged.length);
  console.log("✅ Output:", OUT_FILE);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
