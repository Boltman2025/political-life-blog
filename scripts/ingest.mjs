import fs from "fs/promises";
import path from "path";
import Parser from "rss-parser";
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

// ملف الإخراج
const OUT_FILE = path.join(process.cwd(), "public", "articles.json");

// OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // تقدر تغيّره لاحقاً

const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

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

function randomImage() {
  return `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 2000)}`;
}

function stripHtml(html = "") {
  // تنظيف بسيط بدون مكتبات
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function fetchArticleText(url) {
  // نحاول نجلب المقال (قد يفشل بسبب حمايات/Cloudflare) — عادي
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 political-life-blog/1.0" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const text = stripHtml(html);
    // نقص النص لو كان ضخم
    return text.length > 12000 ? text.slice(0, 12000) : text;
  } catch {
    return "";
  }
}

// ============================
// 4) AI إعادة التحرير
// ============================
async function rewriteWithAI({ title, excerpt, content, sourceUrl, editorialStyle }) {
  // إذا ما عندك مفتاح → رجع كما هو
  if (!client) {
    return { title, excerpt, content };
  }

  const raw = safeText(content || excerpt || title);

  // لو النص قصير جدًا → لا داعي للـ AI
  if (raw.length < 120) {
    return { title, excerpt, content };
  }

  const prompt = `
أنت محرر سياسي جزائري محترف.

المطلوب:
1) اكتب عنوانًا عربيًا جديدًا قويًا (قصير وواضح) مع الحفاظ على معنى الخبر.
2) اكتب ملخصًا (Excerpt) من 2 إلى 4 أسطر.
3) أعد تحرير النص بأسلوب: ${editorialStyle}
قيود صارمة:
- ممنوع اختلاق معلومات غير موجودة في النص.
- إذا كان النص ناقصًا أو غير واضح: قل ذلك بوضوح داخل المحتوى دون اختراع.
- لا تستخدم لغة دعائية.
- اختم بسطر: "المصدر: ${sourceUrl}"

النص الخام:
${raw}
`;

  const schemaHint = `أعد النتيجة في JSON فقط بهذا الشكل:
{
  "title": "....",
  "excerpt": "....",
  "content": "...."
}`;

  try {
    const resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: "أنت مساعد تحرير صحفي. تلتزم بالحقائق ولا تخترع." },
        { role: "user", content: prompt + "\n\n" + schemaHint },
      ],
    });

    const txt = resp.choices?.[0]?.message?.content || "";
    // محاولة استخراج JSON حتى لو جاء معه نص
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { title, excerpt, content };

    const obj = JSON.parse(jsonMatch[0]);

    const newTitle = safeText(obj.title) || title;
    const newExcerpt = safeText(obj.excerpt) || excerpt;
    const newContent = safeText(obj.content) || content;

    return {
      title: newTitle,
      excerpt: newExcerpt.slice(0, 320),
      content: newContent,
    };
  } catch (e) {
    console.log("AI rewrite failed:", String(e?.message || e));
    return { title, excerpt, content };
  }
}

// ============================
// 5) التنفيذ
// ============================
async function main() {
  if (!RSS_FEEDS.length) {
    console.log("RSS_FEEDS is empty. Nothing to ingest.");
    return;
  }

  const existing = await readExisting();
  const collected = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const feedTitle = safeText(feed.title) || feedUrl;

      const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const sourceUrl = it.link || it.guid || "";
        if (!sourceUrl) continue;

        const meta = detectCategory(sourceUrl);

        const originalTitle = safeText(it.title);
        if (!originalTitle) continue;

        // المادة الأولية من RSS
        const rssExcerpt = safeText(it.contentSnippet || it.summary).slice(0, 260);
        const rssContent = safeText(it.content || it["content:encoded"] || it.summary || it.contentSnippet);

        // إذا المحتوى ضعيف، نحاول نجلب من الرابط
        let baseContent = rssContent || rssExcerpt;
        if (safeText(baseContent).length < 350) {
          const fetched = await fetchArticleText(sourceUrl);
          if (fetched && fetched.length > baseContent.length) {
            baseContent = fetched;
          }
        }

        const beforeAIExcerpt = rssExcerpt || safeText(baseContent).slice(0, 220);

        // AI إعادة تحرير
        const rewritten = await rewriteWithAI({
          title: originalTitle,
          excerpt: beforeAIExcerpt,
          content: baseContent,
          sourceUrl,
          editorialStyle: meta.style,
        });

        collected.push({
          id: makeId(it, i),
          title: rewritten.title,
          excerpt: rewritten.excerpt || beforeAIExcerpt,
          content: rewritten.content || baseContent,
          category: meta.category,
          author: safeText(it.creator || it.author || feedTitle || "مصدر"),
          date: pickDate(it),
          imageUrl: randomImage(),
          sourceUrl,
          isBreaking: false,
          editorialStyle: meta.style,
        });
      }
    } catch (e) {
      console.log("Failed feed:", feedUrl);
      console.log(String(e?.message || e));
    }
  }

  // خذ فقط العدد المطلوب
  const newOnes = collected.slice(0, MAX_TOTAL_NEW);

  // دمج + إزالة تكرار (حسب sourceUrl) + حد أقصى 200 خبر محفوظ
  const merged = dedupeBySourceUrl([...newOnes, ...existing]).slice(0, 200);

  // تأكد أن public موجود
  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });

  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  console.log("✅ Wrote articles:", merged.length);
  console.log("✅ New fetched:", newOnes.length);
  console.log("✅ Output:", OUT_FILE);
  console.log("✅ AI enabled:", Boolean(client));
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
