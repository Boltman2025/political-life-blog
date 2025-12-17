// scripts/ingest.mjs
import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "political-life-blog-bot/1.7" },
});

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

const DZ_KEYWORDS = [
  "الجزائر","جزائري","الجزائري","رئيس الجمهورية","الرئيس","تبون",
  "الحكومة","وزارة","البرلمان","المجلس الشعبي","مجلس الأمة",
  "الدستور","الانتخابات","الولاة","ولاية","الجيش","الأمن",
];

const AI_FIELDS = [
  "aiTitle",
  "aiSummary",
  "aiBody",
  "aiBullets",
  "aiTags",
  "aiDoneAt",
  "aiModel",
  "aiFingerprint",
];

const safeText = (x) => String(x || "").replace(/\s+/g, " ").trim();

function isMostlyArabic(text = "") {
  const t = String(text);
  const ar = (t.match(/[\u0600-\u06FF]/g) || []).length;
  const lat = (t.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return ar >= 6 && ar >= lat;
}

function parseDateMaybe(item) {
  const d = item.isoDate || item.pubDate || item.published || item.date || "";
  const dt = d ? new Date(d) : null;
  return dt && !isNaN(dt.getTime()) ? dt : null;
}

const toISO = (dt) => (dt && !isNaN(dt.getTime()) ? dt.toISOString() : "");

function isRecent(dt) {
  if (!dt) return false;
  return Date.now() - dt.getTime() <= HOURS_BACK * 3600 * 1000;
}

function makeStableId(item, idx) {
  const base = item.link || item.guid || item.title || String(idx);
  return (
    "a_" +
    Buffer.from(String(base))
      .toString("base64")
      .replace(/=+/g, "")
      .slice(0, 24)
  );
}

function dedupeBySourceUrl(arr) {
  const seen = new Set();
  const out = [];
  for (const a of arr) {
    const k = String(a.sourceUrl || "").trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

const isAPNUrl = (u = "") => String(u).toLowerCase().includes("apn.dz");

function sourceTier(feedUrl = "") {
  const f = String(feedUrl).toLowerCase();
  if (f.includes("news.google.com")) return "backfill";
  if (f.includes(".dz")) return "dz";
  return "global";
}

function dzScore(a) {
  if (a && a.__local) return 1000;

  let s = 0;
  if (a.sourceTier === "dz") s += 55;
  if (a.sourceTier === "backfill") s += 20;

  const text = `${a.title || ""} ${a.excerpt || ""} ${a.content || ""}`.toLowerCase();
  for (const k of DZ_KEYWORDS) {
    if (text.includes(k.toLowerCase())) s += 5;
  }

  if (isAPNUrl(a.sourceUrl)) s -= 20;
  return s;
}

function sortDzThenNewest(arr) {
  return [...arr].sort((a, b) => {
    const ds = dzScore(b) - dzScore(a);
    if (ds !== 0) return ds;
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return tb - ta;
  });
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

/* ========= Remote RSS (مع فلتر العربية) ========= */
async function ingestRemoteFeeds() {
  const out = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const title = safeText(it.title);
        const sourceUrl = it.link || it.guid || "";
        if (!title || !sourceUrl) continue;

        // ✅ فلتر اللغة: لا نقبل غير العربي
        if (!isMostlyArabic(title)) continue;

        const dt = parseDateMaybe(it);
        if (!isRecent(dt)) continue;

        out.push({
          id: makeStableId(it, i),
          title,
          excerpt: safeText(it.contentSnippet || it.summary).slice(0, 220),
          content: safeText(it.contentSnippet || it.summary || it.content || ""),
          date: toISO(dt),
          sourceUrl,
          sourceTier: sourceTier(feedUrl),
          __local: false,
        });
      }
    } catch (e) {
      console.log("Remote feed failed:", feedUrl, String(e?.message || e));
    }
  }

  return out;
}

/* ========= Local RSS (manual parse) ========= */
function stripCdata(x = "") {
  return String(x).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
}
function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m && m[1] ? stripCdata(m[1]) : "";
}

async function ingestLocalRssDir() {
  const out = [];
  try {
    const files = await fs.readdir(LOCAL_RSS_DIR);
    const xmlFiles = files.filter((f) => f.toLowerCase().endsWith(".xml"));
    console.log("Local RSS files:", xmlFiles);

    for (const f of xmlFiles) {
      const full = path.join(LOCAL_RSS_DIR, f);
      const xml = await fs.readFile(full, "utf-8");

      const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
      console.log(`Local raw items ${f}: items=${items.length}`);

      for (let i = 0; i < Math.min(items.length, MAX_ITEMS_PER_FEED); i++) {
        const block = items[i];
        const title = safeText(extractTag(block, "title"));
        const link = safeText(extractTag(block, "link"));
        const pub = safeText(extractTag(block, "pubDate"));

        if (!title || !link) continue;

        // ✅ حتى المحلي: لو طلع عنوان فرنسي ما ندخلوش
        if (!isMostlyArabic(title)) continue;

        const dt = pub ? new Date(pub) : new Date();
        const finalDt = dt && !isNaN(dt.getTime()) ? dt : new Date();

        out.push({
          id: makeStableId({ link, title }, i),
          title,
          excerpt: "",
          content: "",
          date: toISO(finalDt),
          sourceUrl: link,
          sourceTier: "dz",
          __local: true,
        });
      }
    }

    return out;
  } catch (e) {
    console.log("Local RSS dir read/parse failed:", String(e?.message || e));
    return [];
  }
}

/* ========= Merge helper (يحافظ على AI) ========= */
function mergePreferOldAI(newA, oldA) {
  if (!oldA) return newA;

  const merged = { ...oldA, ...newA };

  // لو الجديد جاء ناقص excerpt/content خذ من القديم
  if (!safeText(merged.excerpt) && safeText(oldA.excerpt)) merged.excerpt = oldA.excerpt;
  if (!safeText(merged.content) && safeText(oldA.content)) merged.content = oldA.content;

  // حافظ على حقول AI من القديم إذا الجديد ما فيهاش
  for (const k of AI_FIELDS) {
    if (merged[k] == null || (typeof merged[k] === "string" && !merged[k].trim())) {
      if (oldA[k] != null) merged[k] = oldA[k];
    }
  }

  return merged;
}

/* ========= Caps + Pick ========= */
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

function pickNewOnes(sorted) {
  const picked = [];
  let apnCount = 0;

  const firstLocalLimit = Math.min(8, MAX_TOTAL_NEW);
  for (const a of sorted) {
    if (picked.length >= firstLocalLimit) break;
    if (a.__local && !isAPNUrl(a.sourceUrl)) picked.push(a);
  }

  for (const a of sorted) {
    if (picked.length >= MAX_TOTAL_NEW) break;
    if (picked.some((x) => x.sourceUrl === a.sourceUrl)) continue;

    const fromAPN = isAPNUrl(a.sourceUrl);
    if (fromAPN) {
      if (apnCount >= APN_CAP_IN_NEW) continue;
      apnCount++;
    }

    picked.push(a);
  }

  return { picked, apnCount };
}

/* ========= MAIN ========= */
async function main() {
  const existing = await readExisting();
  const existingMap = new Map(
    existing
      .filter((x) => x && x.sourceUrl)
      .map((x) => [String(x.sourceUrl).trim(), x])
  );

  const local = await ingestLocalRssDir();
  const remote = await ingestRemoteFeeds();

  const collected = dedupeBySourceUrl([...local, ...remote]);
  const sorted = sortDzThenNewest(collected);

  const { picked, apnCount } = pickNewOnes(sorted);

  // ✅ دمج ذكي: إذا الخبر موجود سابقًا حافظ على AI + البيانات الأقدم
  const pickedMerged = picked.map((a) => mergePreferOldAI(a, existingMap.get(String(a.sourceUrl).trim())));

  // ✅ اجمع picked + existing ثم dedupe (الأولوية للمختار الجديد، لكن مع حفظ AI)
  let merged = dedupeBySourceUrl([...pickedMerged, ...existing]);

  merged = sortDzThenNewest(merged);
  merged = applyApnHardCapTotal(merged).slice(0, MAX_STORE);

  // ✅ حذف __local فقط
  merged = merged.map(({ __local, ...rest }) => rest);

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  const stamp = {
    ranAt: new Date().toISOString(),
    fetchedLocal: local.length,
    fetchedRemote: remote.length,
    wrote: merged.length,
    apnInNew: apnCount,
    top: merged.slice(0, 10).map((x) => ({ title: x.title, url: x.sourceUrl })),
  };

  await fs.writeFile(STAMP_FILE, JSON.stringify(stamp, null, 2), "utf-8");
  console.log("✅ DONE:", stamp);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
