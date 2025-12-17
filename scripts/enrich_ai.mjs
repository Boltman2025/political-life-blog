// scripts/enrich_ai.mjs
import fs from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import OpenAI from "openai";

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");

// ====== ENV ======
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const TEMPERATURE = Number(process.env.OPENAI_TEMPERATURE || "0.4");

// كم مقال نعالجه في كل تشغيل (حتى لا تستهلك API بسرعة)
const MAX_ENRICH_PER_RUN = Number(process.env.AI_MAX_PER_RUN || "6");

// أقصى عدد أحرف نرسلها للموديل من نص المصدر
const MAX_SOURCE_CHARS = Number(process.env.MAX_SOURCE_CHARS || "9000");

// timeout لجلب صفحات المقال
const FETCH_TIMEOUT_MS = Number(process.env.AI_FETCH_TIMEOUT_MS || "20000");

// ساعات الرجوع للخلف (فقط لتفضيل الجديد)
const HOURS_BACK = Number(process.env.AI_HOURS_BACK || "72");

// ====== HELPERS ======
const safeText = (x) => String(x || "").replace(/\s+/g, " ").trim();

function clamp(str, max) {
  const s = String(str || "");
  return s.length > max ? s.slice(0, max) : s;
}

function parseDateMs(iso) {
  const d = iso ? new Date(iso) : null;
  const t = d && !isNaN(d.getTime()) ? d.getTime() : 0;
  return t;
}

function isRecentEnough(a) {
  const t = parseDateMs(a?.date);
  if (!t) return true; // لو ما فيش تاريخ، لا نحذفه من الترشيح
  return Date.now() - t <= HOURS_BACK * 3600 * 1000;
}

function hasAI(a) {
  return Boolean(safeText(a?.aiTitle) || safeText(a?.aiSummary) || safeText(a?.aiBody));
}

function guessSection(a) {
  const s = safeText(a?.section);
  if (s) return s;
  // fallback بسيط
  const tier = String(a?.sourceTier || "").toLowerCase();
  if (tier === "dz") return "وطني";
  return "دولي";
}

async function readArticles() {
  try {
    const raw = await fs.readFile(OUT_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeArticles(arr) {
  await fs.mkdir(path.join(process.cwd(), "public"), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(arr, null, 2), "utf-8");
}

// ====== FETCH + EXTRACT ======
async function fetchWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "political-life-blog-bot/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function extractReadableTextFromHtml(html) {
  const $ = cheerio.load(html);

  // شيل أشياء ثقيلة
  $("script,noscript,style,svg,canvas,iframe,form,nav,header,footer,aside").remove();

  // بعض المواقع تحط المحتوى في article/main
  const candidates = [
    "article",
    "main",
    ".article",
    ".post",
    ".content",
    ".entry-content",
    ".article-content",
    "#content",
  ];

  let text = "";
  for (const sel of candidates) {
    const t = safeText($(sel).text());
    if (t.length > text.length) text = t;
  }

  // fallback: كامل body
  if (text.length < 400) {
    text = safeText($("body").text());
  }

  // تنظيف نهائي
  text = text
    .replace(/\s{2,}/g, " ")
    .replace(/(\n\s*){3,}/g, "\n\n")
    .trim();

  return text;
}

async function getSourceText(article) {
  // 1) لو عندك content/excerpt كافي
  const local =
    safeText(article?.content) ||
    safeText(article?.excerpt) ||
    safeText(article?.description) ||
    "";

  if (local.length >= 600) return local;

  // 2) جرّب تجيب الصفحة
  const url = safeText(article?.sourceUrl);
  if (!url) return local;

  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) return local;

    const ct = String(res.headers.get("content-type") || "");
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return local;

    const html = await res.text();
    const extracted = extractReadableTextFromHtml(html);
    // امزج ما بين الموجود محليًا والمستخرج (بدون تكرار مبالغ)
    const merged = safeText([local, extracted].filter(Boolean).join("\n\n"));
    return merged || local;
  } catch {
    return local;
  }
}

// ====== OPENAI ENRICH ======
function buildPrompt({ title, section, sourceUrl, sourceText }) {
  // ✅ هنا أصلحنا المشكلة: MAX_SOURCE_CHARS لا توضع داخل ${} ثانية
  const clipped = clamp(sourceText, MAX_SOURCE_CHARS);

  return `
أنت محرّر سياسي جزائري يكتب بأسلوب مراكز التفكير: نبرة تحليلية قوية، منطق، سياق، أسباب/نتائج، بدون تهويل، وبدون ذكر أنك ذكاء اصطناعي.
اكتب بالعربية الفصحى، وبـ RTL طبيعي.

المطلوب: أعد صياغة المادة في شكل مقال أصلي محترم للقارئ الجزائري.
- عنوان قوي ومباشر (لا يتجاوز 120 حرفًا)
- ملخص افتتاحي (2-3 جمل) يضع الفكرة الأساسية
- متن تحليلي 5 إلى 9 فقرات قصيرة (كل فقرة 2-4 جمل)
- 5 نقاط مركزة (Bullets) للزبدة
- 6 وسوم (Tags) بالعربية

قيود:
- لا تذكر "وفقًا للذكاء الاصطناعي" أو أي شيء مشابه.
- لا تنسخ النص حرفيًا؛ أعد الصياغة بالكامل.
- لا تضف معلومات غير موجودة في النص إلا إذا كانت "خلفية عامة" شائعة جدًا، وبدون أرقام دقيقة.
- ركّز على الجزائر أولًا إن كان الموضوع مرتبطًا بها.

معلومات:
العنوان الأصلي: ${title || "بدون عنوان"}
القسم المقترح: ${section || "وطني"}
الرابط: ${sourceUrl || "N/A"}

نص المصدر (قد يكون مختصرًا):
${clipped}

أخرج النتيجة في JSON فقط بهذه المفاتيح بالضبط:
{
  "aiTitle": "…",
  "aiSummary": "…",
  "aiBody": "…",
  "aiBullets": ["…","…","…","…","…"],
  "aiTags": ["…","…","…","…","…","…"]
}
`.trim();
}

async function enrichOne(openai, article) {
  const title = safeText(article?.title);
  const section = guessSection(article);
  const sourceUrl = safeText(article?.sourceUrl);
  const sourceText = await getSourceText(article);

  const prompt = buildPrompt({ title, section, sourceUrl, sourceText });

  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: TEMPERATURE,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "أنت محرّر سياسي يكتب مقالات أصلية بأسلوب تحليلي." },
      { role: "user", content: prompt },
    ],
  });

  const content = resp?.choices?.[0]?.message?.content || "{}";

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    // fallback: إذا رجع نص غير JSON
    parsed = {};
  }

  const aiTitle = safeText(parsed.aiTitle);
  const aiSummary = safeText(parsed.aiSummary);
  const aiBody = safeText(parsed.aiBody);
  const aiBullets = Array.isArray(parsed.aiBullets) ? parsed.aiBullets.map(safeText).filter(Boolean) : [];
  const aiTags = Array.isArray(parsed.aiTags) ? parsed.aiTags.map(safeText).filter(Boolean) : [];

  // تحقق حد أدنى
  if (!aiTitle || !aiSummary || !aiBody) {
    throw new Error("AI output missing required fields (aiTitle/aiSummary/aiBody).");
  }

  return {
    ...article,
    aiTitle,
    aiSummary,
    aiBody,
    aiBullets: aiBullets.slice(0, 7),
    aiTags: aiTags.slice(0, 10),
    aiDoneAt: new Date().toISOString(),
    aiModel: MODEL,
  };
}

// ====== MAIN ======
async function main() {
  if (!OPENAI_API_KEY) {
    console.log("❌ OPENAI_API_KEY is missing. Add it to GitHub Secrets.");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const articles = await readArticles();
  if (articles.length === 0) {
    console.log("No articles to enrich.");
    return;
  }

  // اختر المرشحين: بدون AI + حديثين + أولوية dz ثم الأحدث
  const candidates = articles
    .filter((a) => !hasAI(a))
    .filter((a) => isRecentEnough(a))
    .sort((a, b) => {
      const ta = parseDateMs(a.date);
      const tb = parseDateMs(b.date);
      const tierA = String(a.sourceTier || "").toLowerCase();
      const tierB = String(b.sourceTier || "").toLowerCase();
      const dzA = tierA === "dz" ? 1 : 0;
      const dzB = tierB === "dz" ? 1 : 0;
      if (dzA !== dzB) return dzB - dzA;
      return tb - ta;
    })
    .slice(0, MAX_ENRICH_PER_RUN);

  console.log(`Candidates to enrich: ${candidates.length}/${MAX_ENRICH_PER_RUN}`);

  if (candidates.length === 0) {
    console.log("Nothing to enrich (all have AI or outside time window).");
    return;
  }

  // index map
  const byUrl = new Map(articles.map((a, i) => [String(a.sourceUrl || "").trim(), i]));

  let ok = 0;
  let fail = 0;

  for (const a of candidates) {
    const key = String(a.sourceUrl || "").trim();
    const idx = byUrl.get(key);
    if (idx == null) continue;

    try {
      const enriched = await enrichOne(openai, articles[idx]);
      articles[idx] = enriched;
      ok++;
      console.log("✅ enriched:", safeText(enriched.aiTitle).slice(0, 90));
    } catch (e) {
      fail++;
      console.log("❌ enrich failed:", key, String(e?.message || e));
    }
  }

  await writeArticles(articles);
  console.log(`DONE enrich_ai: ok=${ok}, fail=${fail}, wrote=${articles.length}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
