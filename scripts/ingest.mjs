import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import OpenAI from "openai";

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

// AI
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "");
const EDITORIAL_STYLE = String(process.env.EDITORIAL_STYLE || "صحفي احترافي");

// عدد العناصر التي نعالجها بالـ AI في كل تشغيل (حتى لا يصبح بطيئًا/مكلفًا)
const AI_MAX_PER_RUN = Number(process.env.AI_MAX_PER_RUN || "6");

// ============================
// 2) تصنيف + أسلوب حسب المصدر
// ============================
function detectCategory(sourceUrl = "") {
  const url = String(sourceUrl).toLowerCase();

  // 🟢 رسمي
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

  // 🔵 مواقف سياسية
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

  // 🟣 قراءة سياسية
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

// ============================
// 4) الصور: استخراج + fallback غير عشوائي
// ============================
const FALLBACK_IMAGES = [
  // طابع سياسي/مؤسسات (ليست picsum)
  "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1450101215322-bf5cd27642fc?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1524499982521-1ffd58dd89ea?auto=format&fit=crop&w=1200&q=70",
];

function fallbackImage(seed = "") {
  const n = Math.abs(
    Array.from(String(seed)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  );
  return FALLBACK_IMAGES[n % FALLBACK_IMAGES.length];
}

function isRandomPlaceholder(url = "") {
  const u = String(url).toLowerCase();
  return (
    !u ||
    u.includes("picsum.photos") ||
    u.includes("placehold") ||
    u.includes("via.placeholder") ||
    u.includes("dummyimage")
  );
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

// ============================
// 5) أولوية المصادر: Google News أولاً
// ============================
function feedPriority(url = "") {
  const u = String(url).toLowerCase();
  if (u.includes("news.google.com")) return 0;
  if (u.includes("apn.dz")) return 1;
  return 2;
}

// ============================
// 6) AI: عنوان + ملخص + تعليق (بدون اختلاق)
// ============================
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

function buildAiPrompt({ title, excerpt, content, sourceUrl, editorialStyle }) {
  const text = safeText(content || excerpt || "");
  return `
أنت محرر صحفي محترف. مهمتك إعادة تحرير الخبر دون اختلاق أي معلومة.
المصدر: ${sourceUrl}
أسلوب التحرير المطلوب: ${editorialStyle || EDITORIAL_STYLE}

نص الخبر المتاح (قد يكون مقتطفاً فقط):
العنوان الأصلي: ${title}
النص: ${text}

المطلوب:
1) عنوان عربي قوي ومختصر (بدون مبالغة).
2) ملخص احترافي في 2 إلى 3 جمل، يعتمد فقط على النص المتاح.
3) تعليق سياسي قصير جداً (سطر واحد) يضيف قراءة سياقية عامة دون ادعاء حقائق غير موجودة.
قواعد صارمة:
- ممنوع إضافة أرقام/أسماء/اتهامات/تفاصيل غير مذكورة في النص.
- إذا النص غير كافٍ: اكتب في التعليق "لا تتوفر معلومات كافية للتعليق" ولا تخمن.

أعد النتيجة بصيغة JSON فقط بهذا الشكل:
{
  "aiTitle": "...",
  "aiSummary": "...",
  "aiComment": "..."
}
`.trim();
}

async function runAI(article) {
  if (!openai) return null;

  // لا نعيد AI إذا موجود مسبقاً (لتخفيف التكلفة)
  if (article.aiTitle && article.aiSummary && article.aiComment) return null;

  const prompt = buildAiPrompt({
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    sourceUrl: article.sourceUrl,
    editorialStyle: article.editorialStyle,
  });

  // Chat Completions (متوافق ومضمون)
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "أنت مساعد صحفي. لا تختلق معلومات. إذا نقصت البيانات، قل ذلك صراحة.",
      },
      { role: "user", content: prompt },
    ],
  });

  const txt = resp.choices?.[0]?.message?.content || "{}";
  try {
    const obj = JSON.parse(txt);
    return {
      aiTitle: safeText(obj.aiTitle),
      aiSummary: safeText(obj.aiSummary),
      aiComment: safeText(obj.aiComment),
      aiUpdatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
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
        const excerpt = safeText(it.contentSnippet || it.summary).slice(0, 240);
        const content = safeText(it.contentSnippet || it.summary || it.content);

        if (!title) continue;

        // صورة
        let imageUrl = extractImageFromItem(it);
        if (!imageUrl) imageUrl = await extractOgImageFromUrl(sourceUrl);
        if (!imageUrl) imageUrl = fallbackImage(sourceUrl);

        collected.push({
          id: makeId(it, i),
          title,
          excerpt: excerpt || content.slice(0, 240),
          content: content || excerpt,
          category: meta.category,
          author: safeText(it.creator || it.author || feedTitle || "مصدر"),
          date: pickDate(it),
          imageUrl,
          sourceUrl,
          isBreaking: feedPriority(feedUrl) === 0, // Google News = عاجل
          editorialStyle: meta.style,
          feedSource: feedUrl,
        });
      }
    } catch (e) {
      console.log("Failed feed:", feedUrl);
      console.log(String(e?.message || e));
    }
  }

  // جديد فقط
  const newOnes = collected.slice(0, MAX_TOTAL_NEW);

  // دمج + إزالة تكرار
  let merged = dedupeBySourceUrl([...newOnes, ...existing]).slice(0, 200);

  // ✅ تحديث صور المقالات القديمة إذا كانت placeholder
  // نحاول OG image فقط (سريع وفعّال)
  const toFixImages = merged.filter((a) => isRandomPlaceholder(a.imageUrl)).slice(0, 10);
  for (const a of toFixImages) {
    const og = await extractOgImageFromUrl(a.sourceUrl);
    if (og) a.imageUrl = og;
    else a.imageUrl = fallbackImage(a.sourceUrl);
  }

  // ✅ AI: نطبّق على أول عناصر (الأحدث) فقط
  let aiDone = 0;
  for (let i = 0; i < merged.length && aiDone < AI_MAX_PER_RUN; i++) {
    const a = merged[i];
    const ai = await runAI(a);
    if (ai) {
      Object.assign(a, ai);
      aiDone++;
    }
  }

  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  console.log("✅ Wrote articles:", merged.length);
  console.log("✅ New fetched:", newOnes.length);
  console.log("✅ Images fixed:", toFixImages.length);
  console.log("✅ AI enabled:", Boolean(openai));
  console.log("✅ AI updated:", aiDone);
  console.log("✅ Output:", OUT_FILE);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
