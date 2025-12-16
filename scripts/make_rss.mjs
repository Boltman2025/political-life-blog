// scripts/make_rss.mjs
import fs from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";

const OUT_DIR = path.join(process.cwd(), "public", "rss");
const MAX_ITEMS_PER_SITE = 18;
const MAX_LINKS_SCAN = 80;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function clean(x) {
  return String(x || "").replace(/\s+/g, " ").trim();
}

function absUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

function uniq(arr) {
  return [...new Set(arr)].filter(Boolean);
}

function rssEscape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function nowRssDate() {
  return new Date().toUTCString();
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "ar-DZ,ar;q=0.9,fr-FR;q=0.7,fr;q=0.6,en;q=0.5",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return await res.text();
}

function buildRss({ title, link, items }) {
  const lastBuildDate = nowRssDate();
  const xmlItems = items
    .map((it) => {
      const t = rssEscape(it.title);
      const l = rssEscape(it.link);
      const guid = rssEscape(it.link);
      const pubDate = rssEscape(it.pubDate || lastBuildDate);
      return `
<item>
  <title>${t}</title>
  <link>${l}</link>
  <guid isPermaLink="true">${guid}</guid>
  <pubDate>${pubDate}</pubDate>
</item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${rssEscape(title)}</title>
  <link>${rssEscape(link)}</link>
  <description>${rssEscape(title)}</description>
  <lastBuildDate>${rssEscape(lastBuildDate)}</lastBuildDate>
  ${xmlItems}
</channel>
</rss>`;
}

// ✅ مواقع الجزائر
const CONFIGS = [
  { name: "TSA-Politique", url: "https://www.tsa-algerie.com/politique/" },
  { name: "ElKhabar-Nation", url: "https://www.elkhabar.com/nation/" },
  {
    name: "Echorouk-Algerie",
    url: "https://www.echoroukonline.com/category/%d8%a3%d8%ae%d8%a8%d8%a7%d8%b1-%d8%a7%d9%84%d8%ac%d8%b2%d8%a7%d8%a6%d8%b1/",
  },
  {
    name: "Ennahar-Algerie",
    url: "https://www.ennaharonline.com/category/%d8%a7%d9%84%d8%ac%d8%b2%d8%a7%d8%a6%d8%b1/",
  },
  { name: "ElBilad-National", url: "https://www.elbilad.net/national" },
  {
    name: "Algerie360-Politique",
    url: "https://www.algerie360.com/category/actualite/politique/",
  },
  { name: "ObservAlgerie-Algerie", url: "https://www.observalgerie.com/algerie/" },
];

function looksLikeArticle(u) {
  const x = u.toLowerCase();
  if (!x.startsWith("http")) return false;
  if (x.includes("#")) return false;
  if (x.includes("/tag/") || x.includes("/tags/")) return false;
  if (x.includes("/category/") || x.includes("/categorie/")) return false;
  if (x.includes("/page/")) return false;
  if (x.includes("facebook.com") || x.includes("twitter.com") || x.includes("instagram.com"))
    return false;

  // لقبول روابط مقالات
  return /\/\d{4}\//.test(x) || x.split("/").filter(Boolean).length >= 4;
}

async function extractArticleTitle(url) {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const og =
      clean($("meta[property='og:title']").attr("content")) ||
      clean($("meta[name='og:title']").attr("content"));
    const h1 = clean($("h1").first().text());
    const ttl = clean($("title").text());

    return og || h1 || ttl || "";
  } catch {
    return "";
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  let totalItems = 0;
  const perSite = [];

  for (const cfg of CONFIGS) {
    try {
      const html = await fetchHtml(cfg.url);
      const $ = cheerio.load(html);

      let links = $("a")
        .map((_, a) => absUrl(cfg.url, $(a).attr("href")))
        .get();

      links = uniq(links)
        .filter((u) => u && u.startsWith("http"))
        .filter((u) => {
          try {
            return new URL(u).hostname === new URL(cfg.url).hostname;
          } catch {
            return false;
          }
        })
        .filter(looksLikeArticle)
        .slice(0, MAX_LINKS_SCAN);

      const items = [];
      for (const link of links) {
        if (items.length >= MAX_ITEMS_PER_SITE) break;
        const title = await extractArticleTitle(link);
        if (!title) continue;
        items.push({ title, link, pubDate: nowRssDate() });
      }

      totalItems += items.length;
      perSite.push({ name: cfg.name, items: items.length });

      const rss = buildRss({
        title: `DZ Local RSS - ${cfg.name}`,
        link: cfg.url,
        items,
      });

      const outFile = path.join(OUT_DIR, `${cfg.name}.xml`);
      await fs.writeFile(outFile, rss, "utf-8");

      console.log("✅ local rss:", cfg.name, "items:", items.length);
    } catch (e) {
      perSite.push({ name: cfg.name, items: 0, error: String(e?.message || e) });
      console.log("❌ local rss failed:", cfg.name, String(e?.message || e));
    }
  }

  console.log("---- local rss summary ----");
  for (const x of perSite) console.log(x);

  // ✅ Fail hard إذا كان ضعيف جداً
  if (totalItems < 3) {
    console.error("❌ Local RSS generation too weak. totalItems=", totalItems);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
