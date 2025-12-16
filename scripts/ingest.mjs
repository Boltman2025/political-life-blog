import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "political-life-blog-bot/1.1" },
});

/* =========================
   إعدادات عامة
========================= */
const RSS_FEEDS = String(process.env.RSS_FEEDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_ITEMS_PER_FEED = 7;
const MAX_TOTAL_NEW = 12;
const HOURS_BACK = 48;
const MAX_STORE = 40;

// ⛔ كبح صارم لـ APN
const APN_CAP_IN_NEW = 2;
const APN_HARD_CAP_TOTAL = 4;

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");

/* =========================
   كلمات أولوية جزائرية
========================= */
const DZ_KEYWORDS = [
  "الجزائر",
  "جزائري",
  "الجزائر العاصمة",
  "الرئيس",
  "رئيس الجمهورية",
  "تبون",
  "الحكومة",
  "وزارة",
  "البرلمان",
  "المجلس الشعبي",
  "مجلس الأمة",
  "الدستور",
  "الانتخابات",
  "الجيش",
  "الداخلية",
  "الخارجية",
];

/* =========================
   أدوات مساعدة
========================= */
const clean = (x) => String(x || "").replace(/\s+/g, " ").trim();

function parseDate(item) {
  const raw = item.isoDate || item.pubDate || item.published || "";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function isRecent(dt) {
  if (!dt) return false;
  return Date.now() - dt.getTime() <= HOURS_BACK * 3600 * 1000;
}

function makeId(base) {
  return (
    "a_" +
    Buffer.from(base)
      .toString("base64")
      .replace(/=+/g, "")
      .slice(0, 22)
  );
}

function isAPN(url = "") {
  return url.toLowerCase().includes("apn.dz");
}

function isGoogle(feed = "") {
  return feed.toLowerCase().includes("news.google.com");
}

function sourceTier(feedUrl = "") {
  if (isAPN(feedUrl)) return "dz";
  if (isGoogle(feedUrl)) return "backfill";
  if (feedUrl.includes(".dz")) return "dz";
  return "global";
}

/* =========================
   حساب أولوية الجزائر
========================= */
function dzScore(a) {
  let score = 0;

  if (a.sourceTier === "dz") score += 60;
  if (a.sourceTier === "backfill") score += 25;

  const text = `${a.title} ${a.excerpt}`.toLowerCase();
  DZ_KEYWORDS.forEach((k) => {
    if (text.includes(k)) score += 5;
  });

  // تخفيض إضافي لـ APN
  if (isAPN(a.sourceUrl)) score -= 20;

  return score;
}

function sortDzThenNewest(arr) {
  return [...arr].sort((a, b) => {
    const ds = dzScore(b) - dzScore(a);
    if (ds !== 0) return ds;

    const tb = new Date(b.date || 0).getTime();
    const ta = new Date(a.date || 0).getTime();
    return tb - ta;
  });
}

/* =========================
   جلب الأخبار
========================= */
async function ingest() {
  const collected = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

      for (const it of items) {
        const title = clean(it.title);
        const sourceUrl = it.link || it.guid;
        if (!title || !sourceUrl) continue;

        const dt = parseDate(it);
        if (!isRecent(dt)) continue;

        const excerpt = clean(it.contentSnippet || it.summary).slice(0, 240);

        collected.push({
          id: makeId(sourceUrl + title),
          title,
          excerpt,
          content: excerpt,
          date: dt.toISOString(),
          sourceUrl,
          author: clean(it.creator || it.author || feed.title),
          imageUrl: "",
          isBreaking: false,
          sourceTier: sourceTier(feedUrl),
        });
      }
    } catch (e) {
      console.log("Feed failed:", feedUrl);
    }
  }

  return collected;
}

/* =========================
   التنفيذ
========================= */
async function main() {
  if (!RSS_FEEDS.length) {
    console.log("❌ RSS_FEEDS empty");
    return;
  }

  const existing = await (async () => {
    try {
      const raw = await fs.readFile(OUT_FILE, "utf-8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  })();

  const fresh = sortDzThenNewest(await ingest());

  // اختيار 12 جديد + كبح APN
  const picked = [];
  let apnNew = 0;

  for (const a of fresh) {
    if (picked.length >= MAX_TOTAL_NEW) break;
    if (isAPN(a.sourceUrl)) {
      if (apnNew >= APN_CAP_IN_NEW) continue;
      apnNew++;
    }
    picked.push(a);
  }

  // دمج + ترتيب
  let merged = sortDzThenNewest([...picked, ...existing]);

  // كبح APN النهائي (حتى في الإجمالي)
  let apnTotal = 0;
  merged = merged.filter((a) => {
    if (isAPN(a.sourceUrl)) {
      apnTotal++;
      return apnTotal <= APN_HARD_CAP_TOTAL;
    }
    return true;
  });

  merged = merged.slice(0, MAX_STORE);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  console.log("✅ كتب:", merged.length, "خبر");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
