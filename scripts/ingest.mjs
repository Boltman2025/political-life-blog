import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "political-life-blog-bot/1.4" },
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

const safeText = (x) => String(x || "").replace(/\s+/g, " ").trim();

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
    Buffer.from(String(base)).toString("base64").replace(/=+/g, "").slice(0, 20)
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

function dzScore(a) {
  // ✅ local rss أولوية مطلقة
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

function sourceTier(feedUrl = "") {
  const f = String(feedUrl).toLowerCase();
  if (f.startsWith("local:") || f.includes(".dz")) return "dz";
  if (f.includes("news.google.com")) return "backfill";
  return "global";
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

async function ingestLocalRssDir() {
  try {
    const files = await fs.readdir(LOCAL_RSS_DIR);
    const xmlFiles = files.filter((f) => f.toLowerCase().endsWith(".xml"));
    const out = [];

    console.log("Local RSS files:", xmlFiles);

    for (const f of xmlFiles) {
      try {
        const full = path.join(LOCAL_RSS_DIR, f);
        const xml = await fs.readFile(full, "utf-8");

        const feed = await parser.parseString(xml);
        const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

        console.log(`Local parsed ${f}: items=${items.length}`);

        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const title = safeText(it.title);
          const sourceUrl = it.link || it.guid || "";
          if (!title || !sourceUrl) continue;

          const dt = parseDateMaybe(it) || new Date();
          if (!isRecent(dt)) continue;

          out.push({
            id: makeStableId(it, i),
            title,
            excerpt: "",
            content: "",
            date: toISO(dt),
            sourceUrl,
            sourceTier: "dz",
            __local: true,
          });
        }
      } catch (e) {
        console.log("Local RSS parse failed:", f, String(e?.message || e));
      }
    }

    return out;
  } catch (e) {
    console.log("Local RSS dir read failed:", String(e?.message || e));
    return [];
  }
}

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

  // ✅ ابدأ بالمحلي (غير APN) حتى 8
  for (const a of sorted) {
    if (picked.length >= Math.min(8, MAX_TOTAL_NEW)) break;
    if (a.__local && !isAPNUrl(a.sourceUrl)) picked.push(a);
  }

  // ✅ أكمل إلى 12
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

async function main() {
  const existing = await readExisting();

  const local = await ingestLocalRssDir();
  const remote = await ingestRemoteFeeds();

  const collected = dedupeBySourceUrl([
    ...local,
    ...remote,
  ]);

  const sorted = sortDzThenNewest(collected);

  const { picked, apnCount } = pickNewOnes(sorted);

  let merged = sortDzThenNewest(dedupeBySourceUrl([...picked, ...existing]));
  merged = applyApnHardCapTotal(merged).slice(0, MAX_STORE);

  // ✅ احذف __local قبل الحفظ
  merged = merged.map(({ __local, ...rest }) => rest);

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  const stamp = {
    ranAt: new Date().toISOString(),
    fetchedLocal: local.length,
    fetchedRemote: remote.length,
    wrote: merged.length,
    apnInNew: apnCount,
    localRssDir: "public/rss/*.xml",
    top: merged.slice(0, 8).map((x) => ({ title: x.title, url: x.sourceUrl })),
  };
  await fs.writeFile(STAMP_FILE, JSON.stringify(stamp, null, 2), "utf-8");

  console.log("✅ DONE:", stamp);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
