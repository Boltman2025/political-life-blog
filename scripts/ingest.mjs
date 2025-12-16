import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "political-life-blog-bot/1.2" },
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

// ✅ كبح APN
const APN_CAP_IN_NEW = 2;      // داخل 12 خبر جديد
const APN_HARD_CAP_TOTAL = 4;  // داخل 40 إجمالي

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");
const STAMP_FILE = path.join(process.cwd(), "public", "_ingest_stamp.json");
const LOCAL_RSS_DIR = path.join(process.cwd(), "public", "rss");

// ============================
// 2) كلمات "جزائر" لأولوية الترتيب
// ============================
const DZ_KEYWORDS = [
  "الجزائر",
  "جزائري",
  "الجزائري",
  "رئيس الجمهورية",
  "الرئيس",
  "تبون",
  "الحكومة",
  "وزارة",
  "البرلمان",
  "المجلس الشعبي",
  "مجلس الأمة",
  "الدستور",
  "الانتخابات",
  "الولاة",
  "ولاية",
  "الجيش",
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
  if (!dt) return false;
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

function isAPNUrl(u = "") {
  return String(u).toLowerCase().includes("apn.dz");
}

function sourceTier(feedUrl = "") {
  const f = String(feedUrl).toLowerCase();
  if (f.startsWith("local:")) return "dz";
  if (f.includes("apn.dz") || f.includes(".dz")) return "dz";
  if (f.includes("news.google.com")) return "backfill";
  return "global";
}

// ============================
// 5) ترتيب "جزائري ثم الأحدث"
// ============================
function dzScore(a) {
  let s = 0;

  if (a.sourceTier === "dz") s += 55;
  if (a.sourceTier === "backfill") s += 20;

  const text = `${a.title || ""} ${a.excerpt || ""} ${a.content || ""}`.toLowerCase();
  for (const k of DZ_KEYWORDS) {
    if (text.includes(k.toLowerCase())) s += 5;
  }

  // تخفيض APN
  if (isAPNUrl(a.sourceUrl)) s -= 15;

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
// 6) تصنيف بسيط
// ============================
function detectCategory(sourceUrl = "", feedUrl = "") {
  const u = String(sourceUrl).toLowerCase();
  const f = String(feedUrl).toLowerCase();

  if (u.includes("apn.dz") || f.includes("apn.dz")) {
    return { category: "رسمي", style: "أسلوب خبري رسمي محايد دون رأي." };
  }

  if (f.startsWith("local:") || f.includes(".dz") || f.includes("awras.com")) {
    return { category: "شأن جزائري", style: "أسلوب تفسيري دون انحياز." };
  }

  if (f.includes("news.google.com")) {
    return { category: "شأن جزائري", style: "تلخيص سريع دون تهويل." };
  }

  return { category: "دولي", style: "أسلوب خبري هادئ." };
}

// ============================
// 7) جلب RSS خارجي
// ============================
async function ingestRemoteFeeds(feeds) {
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

        out.push({
          id: makeStableId(it, i),
          title,
          excerpt: excerpt || content.slice(0, 220),
          content: content || excerpt,
          category: meta.category,
          author: safeText(it.creator || it.author || feedTitle || "مصدر"),
          date: toISO(dt),
          imageUrl: "",
          sourceUrl,
          isBreaking: false,
          editorialStyle: meta.style,
          sourceTier: sourceTier(feedUrl),
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
// 8) جلب RSS محلي من public/rss/*.xml
// ============================
async function ingestLocalRssDir() {
  try {
    const files = await fs.readdir(LOCAL_RSS_DIR);
    const xmlFiles = files.filter((f) => f.toLowerCase().endsWith(".xml"));

    const out = [];
    for (const f of xmlFiles) {
      const full = path.join(LOCAL_RSS_DIR, f);
      try {
        const xml = await fs.readFile(full, "utf-8");
        const feed = await parser.parseString(xml);
        const feedUrl = `local:${f}`;
        const feedTitle = safeText(feed.title) || f;

        const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const title = safeText(it.title);
          const sourceUrl = it.link || it.guid || "";
          if (!title || !sourceUrl) continue;

          // RSS المحلي ما عنده pubDate موثوق دائمًا، نقبله حتى بدون تاريخ
          const dt = parseDateMaybe(it) || new Date();
          if (!isRecent(dt, HOURS_BACK)) continue;

          const meta = detectCategory(sourceUrl, feedUrl);
          const excerpt = safeText(it.contentSnippet || it.summary).slice(0, 220);

          out.push({
            id: makeStableId(it, i),
            title,
            excerpt: excerpt || "",
            content: excerpt || "",
            category: meta.category,
            author: feedTitle,
            date: toISO(dt),
            imageUrl: "",
            sourceUrl,
            isBreaking: false,
            editorialStyle: meta.style,
            sourceTier: sourceTier(feedUrl), // dz
          });
        }
      } catch (e) {
        console.log("Local RSS parse failed:", f, String(e?.message || e));
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ============================
// 9) اختيار 12 خبر: جزائري أولاً + كبح APN
// ============================
function pickNewOnes(collectedSorted) {
  const picked = [];
  let apnCount = 0;

  for (const a of collectedSorted) {
    if (picked.length >= MAX_TOTAL_NEW) break;

    const fromAPN = isAPNUrl(a.sourceUrl);
    if (fromAPN) {
      if (apnCount >= APN_CAP_IN_NEW) continue;
      apnCount++;
    }

    picked.push(a);
  }

  return { picked, apnCount };
}

// ============================
// 10) كبح APN في الإجمالي
// ============================
function applyApnHardCapTotal(arr) {
  let apn = 0;
  const out = [];
  for (const a of arr) {
    if (isAPNUrl(a.sourceUrl)) {
      apn++;
      if (apn > APN_HARD_CAP_TOTAL) continue;
    }
    out.push(a);
    if (out.length >= MAX_STORE) break;
  }
  return out;
}

// ============================
// 11) التنفيذ
// ============================
async function main() {
  const existing = await readExisting();

  const remote = await ingestRemoteFeeds(RSS_FEEDS);
  const local = await ingestLocalRssDir();

  const collected = dedupeBySourceUrl([...local, ...remote]);

  const collectedSorted = sortDzThenNewest(collected);

  const { picked: newOnes, apnCount } = pickNewOnes(collectedSorted);

  let merged = sortDzThenNewest(dedupeBySourceUrl([...newOnes, ...existing]));
  merged = applyApnHardCapTotal(merged).slice(0, MAX_STORE);

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  const stamp = {
    ranAt: new Date().toISOString(),
    hoursBack: HOURS_BACK,
    maxStore: MAX_STORE,
    maxTotalNew: MAX_TOTAL_NEW,
    apnCapInNew: APN_CAP_IN_NEW,
    apnHardCapTotal: APN_HARD_CAP_TOTAL,
    apnInNew: apnCount,
    feedsRemote: RSS_FEEDS.length,
    localRssDir: "public/rss/*.xml",
    fetchedRemote: remote.length,
    fetchedLocal: local.length,
    wrote: merged.length,
    top: merged.slice(0, 8).map((x) => ({
      title: x.title,
      date: x.date,
      tier: x.sourceTier,
      url: x.sourceUrl,
    })),
  };

  await fs.writeFile(STAMP_FILE, JSON.stringify(stamp, null, 2), "utf-8");

  console.log("✅ Remote fetched:", remote.length);
  console.log("✅ Local fetched:", local.length);
  console.log("✅ New picked:", newOnes.length, "(APN in new:", apnCount, ")");
  console.log("✅ Wrote:", merged.length);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
