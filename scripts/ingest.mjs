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

const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || "7");
const MAX_TOTAL_NEW = Number(process.env.MAX_TOTAL_NEW || "12");
const HOURS_BACK = Number(process.env.HOURS_BACK || "36");
const MAX_STORE = Number(process.env.MAX_STORE || "40");

// ✅ كبح APN حتى لا يهيمن
const APN_CAP_IN_NEW = 2;

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");
const STAMP_FILE = path.join(process.cwd(), "public", "_ingest_stamp.json");

// ============================
// 2) كلمات "جزائر" لأولوية الترتيب
// ============================
const DZ_KEYWORDS = [
  "الجزائر",
  "جزائري",
  "الجزائري",
  "الجزائر العاصمة",
  "العاصمة",
  "رئيس الجمهورية",
  "الرئيس",
  "الحكومة",
  "الوزارة",
  "وزارة",
  "البرلمان",
  "المجلس الشعبي",
  "مجلس الأمة",
  "الدستور",
  "الانتخابات",
  "الولاة",
  "ولاية",
  "الجيش",
  "الدرك",
  "الأمن",
];

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
  return dt && !isNaN(dt.getTime()) ? dt.toISOString() : "";
}

function isRecent(dt, hoursBack) {
  if (!dt) return false; // ✅ بدون تاريخ = مرفوض (يمنع القديم/غير الموثوق)
  const msBack = hoursBack * 60 * 60 * 1000;
  return Date.now() - dt.getTime() <= msBack;
}

function makeStableId(item, idx) {
  const base = item.link || item.guid || item.id || item.title || String(idx);
  const hash = Buffer.from(String(base)).toString("base64").replace(/=+/g, "").slice(0, 20);
  return `a_${hash}`;
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

// ============================
// 4) تحديد نوع المصدر
// ============================
function isGoogle(feedUrl = "") {
  return String(feedUrl).toLowerCase().includes("news.google.com");
}

function isAPN(feedUrl = "") {
  return String(feedUrl).toLowerCase().includes("apn.dz");
}

function isAwrass(feedUrl = "") {
  return String(feedUrl).toLowerCase().includes("awras.com");
}

function sourceTier(feedUrl = "") {
  // dz-local: awrass + apn
  if (isAwrass(feedUrl) || isAPN(feedUrl)) return "dz";
  // google backfill
  if (isGoogle(feedUrl)) return "backfill";
  // default
  return "global";
}

// ============================
// 5) ترتيب "جزائري ثم الأحدث"
// ============================
function dzScore(a) {
  let s = 0;

  // مواقع جزائرية مباشرة = دفعة قوية
  if (a.sourceTier === "dz") s += 50;

  const text = `${a.title || ""} ${a.excerpt || ""} ${a.content || ""}`.toLowerCase();

  for (const k of DZ_KEYWORDS) {
    if (text.includes(k.toLowerCase())) s += 5;
  }

  // APN نعطيه وزن أقل حتى لا يهيمن (مازال رسمي حاضر)
  if (String(a.sourceUrl || "").toLowerCase().includes("apn.dz")) s -= 10;

  return s;
}

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

// ============================
// 6) صور fallback + استخراج صورة
// ============================
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

// ============================
// 7) تصنيف بسيط
// ============================
function detectCategory(sourceUrl = "", feedUrl = "") {
  const u = String(sourceUrl).toLowerCase();
  const f = String(feedUrl).toLowerCase();

  if (f.includes("apn.dz") || u.includes("apn.dz")) {
    return { category: "رسمي", style: "أسلوب خبري رسمي محايد دون رأي." };
  }

  if (f.includes("awras.com") || u.includes("awras.com")) {
    return { category: "شأن جزائري", style: "أسلوب تفسيري دون انحياز." };
  }

  if (f.includes("news.google.com")) {
    return { category: "شأن جزائري", style: "تلخيص سريع دون تهويل." };
  }

  return { category: "دولي", style: "أسلوب خبري هادئ." };
}

// ============================
// 8) جلب الأخبار
// ============================
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

        const meta = detectCategory(sourceUrl, feedUrl);
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
          sourceTier: sourceTier(feedUrl), // dz / backfill / global
        });
      }
    } catch (e) {
      console.log("Failed feed:", feedUrl);
      console.log(String(e?.message || e));
    }
  }

  return out;
}

// ============================
// 9) اختيار 12 خبر: جزائري أولاً + كبح APN
// ============================
function pickNewOnes(collectedSorted) {
  const picked = [];
  let apnCount = 0;

  for (const a of collectedSorted) {
    if (picked.length >= MAX_TOTAL_NEW) break;

    const fromAPN = String(a.sourceUrl || "").toLowerCase().includes("apn.dz");
    if (fromAPN) {
      if (apnCount >= APN_CAP_IN_NEW) continue;
      apnCount++;
    }

    picked.push(a);
  }

  return { picked, apnCount };
}

// ============================
// 10) التنفيذ
// ============================
async function main() {
  if (!RSS_FEEDS.length) {
    console.log("RSS_FEEDS is empty. Nothing to ingest.");
    return;
  }

  const existing = await readExisting();

  const collected = await ingestFeeds(RSS_FEEDS);

  // ✅ ترتيب جزائري ثم الأحدث (لتثبيت الصفحة وتقليل القفزات)
  const collectedSorted = sortDzThenNewest(dedupeBySourceUrl(collected));

  // ✅ الجديد = 12 فقط مع كبح APN
  const { picked: newOnes, apnCount } = pickNewOnes(collectedSorted);

  // ✅ دمج: الجديد ثم القديم، ثم ترتيب نهائي "جزائري ثم الأحدث"
  const merged = sortDzThenNewest(dedupeBySourceUrl([...newOnes, ...existing])).slice(0, MAX_STORE);

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  const stamp = {
    ranAt: new Date().toISOString(),
    hoursBack: HOURS_BACK,
    maxStore: MAX_STORE,
    maxTotalNew: MAX_TOTAL_NEW,
    apnCapInNew: APN_CAP_IN_NEW,
    apnInNew: apnCount,
    feedsCount: RSS_FEEDS.length,
    fetched: collected.length,
    wrote: merged.length,
    top: merged.slice(0, 8).map((x) => ({
      title: x.title,
      date: x.date,
      tier: x.sourceTier,
      url: x.sourceUrl,
    })),
  };

  await fs.writeFile(STAMP_FILE, JSON.stringify(stamp, null, 2), "utf-8");

  console.log("✅ HOURS_BACK:", HOURS_BACK);
  console.log("✅ Fetched total:", collected.length);
  console.log("✅ New picked:", newOnes.length, "(APN in new:", apnCount, ")");
  console.log("✅ Wrote articles:", merged.length);
  console.log("✅ Output:", OUT_FILE);
  console.log("✅ Stamp:", STAMP_FILE);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
