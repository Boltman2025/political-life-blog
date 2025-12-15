import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";
import * as cheerio from "cheerio";

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
// 3) أدوات مساعدة عامة
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

// ============================
// 4) فلترة الجزائر + أولوية المصادر
// ============================
function sourcePriority(sourceUrl = "") {
  const u = String(sourceUrl).toLowerCase();
  if (u.includes("news.google.com")) return 0;
  if (u.includes("apn.dz") || u.includes("aps.dz")) return 1;
  return 5;
}

function isLikelyAlgeria(itemTitle = "", itemContent = "") {
  const t = (String(itemTitle) + " " + String(itemContent)).toLowerCase();

  const dzSignals = [
    "الجزائر","جزائري","جزائرية","الجزائري","الجزائر العاصمة",
    "algeria","algerian","algiers",
    "algérie","algérien","algérienne",
  ];

  const offTopicSignals = [
    "إسرائيل","غزة","حماس","نتنياهو",
    "israel","gaza","hamas","netanyahu",
    "palestine","ukraine","russia",
  ];

  const hasDZ = dzSignals.some((k) => t.includes(k));
  const hasOff = offTopicSignals.some((k) => t.includes(k));

  if (hasOff && !hasDZ) return false;
  if (hasDZ) return true;
  return true;
}

// ============================
// 5) صور: RSS + Scrape og:image + fallback
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

async function fetchPageMeta(url) {
  try {
    if (!url || !String(url).startsWith("http")) return { image: "", canonical: "", site: "" };

    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (political-life-blog-bot/1.0)" },
    });
    if (!res.ok) return { image: "", canonical: "", site: "" };

    const html = await res.text();
    const $ = cheerio.load(html);

    const ogImage = $('meta[property="og:image"]').attr("content") || "";
    const twImage = $('meta[name="twitter:image"]').attr("content") || "";
    const canonical =
      $('link[rel="canonical"]').attr("href") ||
      $('meta[property="og:url"]').attr("content") ||
      "";

    const site =
      $('meta[property="og:site_name"]').attr("content") ||
      $('meta[name="application-name"]').attr("content") ||
      new URL(url).hostname;

    const img = (ogImage || twImage || "").trim();

    return {
      image: img.startsWith("http") ? img : "",
      canonical: canonical.startsWith("http") ? canonical : "",
      site: safeText(site),
    };
  } catch {
    return { image: "", canonical: "", site: "" };
  }
}

// ============================
// 6) ✅ استخراج الرابط الأصلي من Google News
// ============================
function tryExtractGoogleUrlParam(googleLink = "") {
  try {
    const u = new URL(googleLink);
    // أحيانًا يأتي كـ url= داخل query
    const direct = u.searchParams.get("url");
    if (direct && direct.startsWith("http")) return direct;
    return "";
  } catch {
    return "";
  }
}

async function resolveFinalLink(originalLink = "") {
  const link = String(originalLink || "");
  if (!link) return { finalUrl: "", finalSite: "" };

  // إذا ليس Google News → هو نفسه
  if (!link.includes("news.google.com")) {
    const site = (() => {
      try { return new URL(link).hostname; } catch { return ""; }
    })();
    return { finalUrl: link, finalSite: site };
  }

  // محاولة url= مباشرة
  const byParam = tryExtractGoogleUrlParam(link);
  if (byParam) {
    const site = (() => {
      try { return new URL(byParam).hostname; } catch { return ""; }
    })();
    return { finalUrl: byParam, finalSite: site };
  }

  // محاولة قراءة صفحة Google واستخراج canonical
  const meta = await fetchPageMeta(link);
  const finalUrl = meta.canonical || link;
  const finalSite = (() => {
    try { return new URL(finalUrl).hostname; } catch { return meta.site || ""; }
  })();

  return { finalUrl, finalSite };
}

// ============================
// 7) التنفيذ
// ============================
async function main() {
  if (!RSS_FEEDS.length) {
    console.log("RSS_FEEDS is empty. Nothing to ingest.");
    return;
  }

  const existing = await readExisting();
  const existingLinks = new Set(existing.map((a) => String(a.sourceUrl || "").trim()));

  const collected = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const feedTitle = safeText(feed.title) || feedUrl;

      let items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

      // فلترة خاصة لـ Google News
      if (String(feedUrl).toLowerCase().includes("news.google.com")) {
        items = items.filter((it) =>
          isLikelyAlgeria(it?.title || "", it?.contentSnippet || it?.content || "")
        );
      }

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const rawLink = it.link || it.guid || "";
        if (!rawLink) continue;

        // ✅ حل Google News: نحول للرابط الأصلي
        const { finalUrl, finalSite } = await resolveFinalLink(rawLink);
        const sourceUrl = finalUrl || rawLink;

        if (!sourceUrl) continue;
        if (existingLinks.has(sourceUrl)) continue;

        const meta = detectCategory(sourceUrl);

        const title = safeText(it.title);
        const excerpt = safeText(it.contentSnippet || it.summary).slice(0, 220);
        const content = safeText(it.contentSnippet || it.summary || it.content);

        if (!title) continue;

        // 1) صورة من RSS
        const rssImg = extractImageFromItem(it);

        // 2) إذا لا: خذ صورة من الصفحة الأصلية
        const pageMeta = rssImg ? { image: "", site: "", canonical: "" } : await fetchPageMeta(sourceUrl);
        const imageUrl = rssImg || pageMeta.image || fallbackImage();

        const author =
          safeText(it.creator || it.author) ||
          safeText(pageMeta.site) ||
          safeText(finalSite) ||
          feedTitle ||
          "مصدر";

        const breaking =
          String(feedUrl).toLowerCase().includes("news.google.com") ||
          meta.category === "رسمي";

        collected.push({
          id: makeId(it, i),
          title,
          excerpt: excerpt || content.slice(0, 220),
          content: content || excerpt,
          category: meta.category,
          author,
          date: pickDate(it),
          imageUrl,
          sourceUrl,       // ✅ رابط أصلي (أفضل للزوار)
          isBreaking: !!breaking,
          editorialStyle: meta.style,
        });

        if (collected.length >= MAX_TOTAL_NEW) break;
      }
    } catch (e) {
      console.log("Failed feed:", feedUrl);
      console.log(String(e?.message || e));
    }
  }

  // ترتيب: Google أولاً ثم الأحدث
  collected.sort((a, b) => {
    const pa = sourcePriority(a.sourceUrl);
    const pb = sourcePriority(b.sourceUrl);
    if (pa !== pb) return pa - pb;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

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
