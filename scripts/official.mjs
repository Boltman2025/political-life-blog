import fs from "fs/promises";
import path from "path";
import cheerio from "cheerio";

const OUT_FILE = path.join(process.cwd(), "public", "official.json");

const UA =
  "Mozilla/5.0 (compatible; political-life-blog-bot/1.0; +https://politique-dz.online)";

const TIMEOUT_MS = 20000;
const SLEEP_BETWEEN_MS = 1200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ar,fr,en;q=0.8" },
      signal: ac.signal
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(t);
  }
}

function cleanText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function toISODate(d) {
  const dt = d ? new Date(d) : new Date();
  return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
}

function makeId(base, idx) {
  const hash = Buffer.from(String(base)).toString("base64").slice(0, 16);
  return `${Date.now()}_${idx}_${hash}`;
}

const OFFICIAL_SOURCES = [
  {
    name: "رئاسة الجمهورية",
    homepage: "https://www.el-mouradia.dz/ar/home",
    listUrl: "https://www.el-mouradia.dz/ar/home",
    category: "رسمي",
    parseList: ($) => {
      const links = [];
      $("a").each((_, a) => {
        const href = $(a).attr("href");
        const title = cleanText($(a).text());
        if (!href) return;
        if (!title || title.length < 10) return;

        if (
          href.includes("/ar/") &&
          (href.includes("news") ||
            href.includes("actualite") ||
            href.includes("article") ||
            href.includes("detail") ||
            href.includes("communique"))
        ) {
          links.push({ href, title });
        }
      });
      return links.slice(0, 15);
    }
  },
  {
    name: "وزارة الدفاع الوطني",
    homepage: "https://www.mdn.dz/",
    listUrl: "https://www.mdn.dz/site_principal/index.php?lang=ar",
    category: "رسمي",
    parseList: ($) => {
      const links = [];
      $("a").each((_, a) => {
        const href = $(a).attr("href");
        const title = cleanText($(a).text());
        if (!href) return;
        if (!title || title.length < 10) return;

        if (
          href.includes("index.php") ||
          href.includes("article") ||
          href.includes("communique") ||
          href.includes("actualite")
        ) {
          links.push({ href, title });
        }
      });
      return links.slice(0, 15);
    }
  }
];

function absolutize(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

async function scrapeOneSource(src) {
  const { ok, status, text } = await fetchHtml(src.listUrl);
  if (!ok) {
    console.log(`❌ OFFICIAL list failed: ${src.name} (${status})`);
    return [];
  }

  const $ = cheerio.load(text);
  const items = src.parseList($);

  const out = [];
  for (let i = 0; i < items.length; i++) {
    const url = absolutize(src.homepage, items[i].href);
    if (!url) continue;

    out.push({
      id: makeId(url, i),
      title: cleanText(items[i].title),
      excerpt: "",
      content: "",
      category: src.category,
      author: src.name,
      date: toISODate(new Date()),
      imageUrl: "",
      sourceUrl: url,
      isBreaking: true,
      editorialStyle: "أسلوب رسمي محايد يذكر الوقائع فقط دون استنتاجات.",
      sourceKind: "official_scrape"
    });
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

function dedupeByUrl(arr) {
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

async function main() {
  const existing = await readExisting();
  const collected = [];

  for (const src of OFFICIAL_SOURCES) {
    try {
      console.log(`🔎 OFFICIAL scrape: ${src.name}`);
      const got = await scrapeOneSource(src);
      collected.push(...got);
    } catch (e) {
      console.log(`❌ OFFICIAL scrape error: ${src.name}`);
      console.log(String(e?.message || e));
    }
    await sleep(SLEEP_BETWEEN_MS);
  }

  const merged = dedupeByUrl([...collected, ...existing]).slice(0, 200);

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  console.log("✅ Wrote official:", merged.length);
  console.log("✅ Output:", OUT_FILE);
}

main().catch((e) => {
  console.error("Fatal official:", e);
  process.exit(1);
});
