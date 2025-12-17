// scripts/enrich_ai.mjs
import fs from "fs";
import path from "path";
import crypto from "crypto";
import cheerio from "cheerio";
import OpenAI from "openai";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const ARTICLES_PATH = path.join(PUBLIC_DIR, "articles.json");
const AI_CACHE_PATH = path.join(PUBLIC_DIR, "_ai_cache.json");
const ENRICH_STAMP_PATH = path.join(PUBLIC_DIR, "_enrich_stamp.json");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const MAX_ENRICH_PER_RUN = Number(process.env.MAX_ENRICH_PER_RUN || "6");
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || "18000");
const MAX_SOURCE_CHARS = Number(process.env.MAX_SOURCE_CHARS || "7000");

function readJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}

function sha1(s) {
  return crypto.createHash("sha1").update(String(s || ""), "utf8").digest("hex");
}

function cleanText(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function makeFingerprint(a) {
  // بصمة تعتمد على أهم ما يتغير عادة
  const base = [
    a.sourceUrl || "",
    a.date || "",
    a.title || "",
    a.excerpt || "",
    a.content || "",
  ].join("||");
  return sha1(base);
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(t);
  }
}

function extractMainTextFromHtml(html) {
  if (!html) return "";
  const $ = cheerio.load(html);

  // إزالة الضجيج
  $("script, style, noscript, iframe, svg, nav, footer, header, form").remove();

  // محاولة التقاط المحتوى الرئيسي
  const candidates = [
    "article",
    "main",
    ".article",
    ".post",
    ".entry-content",
    ".content",
    ".post-content",
    ".single-content",
  ];

  let $root = null;
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el && el.length) {
      $root = el;
      break;
    }
  }
  if (!$root) $root = $("body");

  // اجمع نص الفقرات والعناوين
  const parts = [];
  $root.find("h1,h2,h3,p,li").each((_, el) => {
    const t = cleanText($(el).text());
    if (t && t.length >= 20) parts.push(t);
  });

  const joined = cleanText(parts.join("\n"));
  return joined;
}

function clamp(s, n) {
  const t = cleanText(s);
  return t.length > n ? t.slice(0, n) : t;
}

function toArabicSection(section) {
  const s = String(section || "").trim();
  if (!s) return "";
  // في حال جاءت أقسام بالفرنسية/الإنجليزية
  const map = {
    national: "وطني",
    algeria: "وطني",
    politics: "وطني",
    economy: "اقتصاد",
    economic: "اقتصاد",
    world: "دولي",
    international: "دولي",
    society: "مجتمع",
    sports: "رياضة",
    opinion: "رأي",
  };
  const key = s.toLowerCase();
  return map[key] || s;
}

function buildPrompt({ title, excerpt, sourceText, section }) {
  const sec = toArabicSection(section) || "وطني";
  return `
أنت محرر سياسي جزائري بنبرة "مراكز تفكير".
اكتب بالعربية الفصحى الواضحة (بدون ذكر أنك ذكاء اصطناعي).
الهدف: إنتاج نسخة تحريرية قوية من خبر سياسي/اقتصادي.

المطلوب: أرجع JSON فقط بهذه المفاتيح:
{
  "aiTitle": string,        // عنوان قوي ومباشر (8-14 كلمة)
  "aiSummary": string,      // ملخص تحليلي (2-4 جمل)
  "aiBody": string,         // تحليل موسع (6-10 فقرات قصيرة) يشرح السياق والتداعيات
  "aiBullets": string[],    // 4-6 نقاط مركزة (ماذا يعني؟ لماذا الآن؟ ماذا بعد؟)
  "aiTags": string[]        // 5-10 وسوم عربية قصيرة
}

قواعد:
- لا تذكر "AI" ولا "تمت إعادة الصياغة".
- إذا كان النص المصدر بالفرنسية أو الإنجليزية، ترجم المعنى للعربية.
- تجنب القذف والاتهامات غير المثبتة. اعتمد على ما ورد في المصدر + استنتاجات منطقية عامة.
- القسم: "${sec}"
- إن لم يتوفر نص كافٍ، اعمل على العنوان والملخص، ثم قدّم تحليلًا عامًا منضبطًا دون اختلاق تفاصيل رقمية.

المواد المتاحة:
العنوان الأصلي: "${clamp(title, 240)}"
الملخص الأصلي: "${clamp(excerpt, 600)}"
نص المصدر (قد يكون مقتطفًا): """
${clamp(sourceText, ${MAX_SOURCE_CHARS})}
"""
`.trim();
}

function safeParseJson(text) {
  const t = String(text || "").trim();
  // محاولة التقاط JSON من داخل نص
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = t.slice(start, end + 1);
    return JSON.parse(slice);
  }
  return JSON.parse(t);
}

function normalizeAiPayload(obj) {
  const aiTitle = cleanText(obj.aiTitle || "");
  const aiSummary = cleanText(obj.aiSummary || "");
  const aiBody = String(obj.aiBody || "").trim();
  const aiBullets = Array.isArray(obj.aiBullets) ? obj.aiBullets.map(cleanText).filter(Boolean) : [];
  const aiTags = Array.isArray(obj.aiTags) ? obj.aiTags.map(cleanText).filter(Boolean) : [];

  return {
    aiTitle: aiTitle || "",
    aiSummary: aiSummary || "",
    aiBody: aiBody || "",
    aiBullets: aiBullets.slice(0, 8),
    aiTags: aiTags.slice(0, 12),
  };
}

async function enrichOne(openai, a) {
  const title = a.title || "";
  const excerpt = a.excerpt || a.contentSnippet || "";
  const section = a.section || "";

  let sourceText = "";
  if (a.sourceUrl) {
    const { ok, text } = await fetchWithTimeout(a.sourceUrl, FETCH_TIMEOUT_MS);
    if (ok && text) {
      sourceText = extractMainTextFromHtml(text);
    }
  }

  // fallback لو المصدر مقفول
  if (!sourceText) {
    sourceText = [title, excerpt, a.content || ""].filter(Boolean).join("\n");
  }

  const prompt = buildPrompt({ title, excerpt, sourceText, section });

  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.25,
    messages: [
      { role: "system", content: "أنت محرر سياسي محترف. أعد JSON فقط." },
      { role: "user", content: prompt },
    ],
    // إن دعمتها المنصة: ستجبر JSON (إن لم تُدعم، لا تضر)
    response_format: { type: "json_object" },
  });

  const content = resp?.choices?.[0]?.message?.content || "";
  const parsed = safeParseJson(content);
  return normalizeAiPayload(parsed);
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY in env.");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const articles = readJsonSafe(ARTICLES_PATH, []);
  if (!Array.isArray(articles) || articles.length === 0) {
    console.log("No articles.json or empty list. Nothing to enrich.");
    writeJson(ENRICH_STAMP_PATH, { ok: true, enriched: 0, skipped: 0, at: new Date().toISOString() });
    process.exit(0);
  }

  const cache = readJsonSafe(AI_CACHE_PATH, {});
  const cacheMap = typeof cache === "object" && cache ? cache : {};

  // 1) أعد تطبيق الكاش أولًا (حتى لو ingest يمسح حقول ai)
  let restored = 0;
  for (const a of articles) {
    const key = a.sourceUrl || a.id;
    if (!key) continue;
    const fp = makeFingerprint(a);
    const hit = cacheMap[key];
    if (hit && hit.fingerprint === fp && hit.aiTitle) {
      a.aiTitle = hit.aiTitle;
      a.aiSummary = hit.aiSummary;
      a.aiBody = hit.aiBody;
      a.aiBullets = hit.aiBullets;
      a.aiTags = hit.aiTags;
      a.aiModel = hit.aiModel;
      a.aiDoneAt = hit.aiDoneAt;
      a.aiFingerprint = hit.fingerprint;
      restored++;
    }
  }

  // 2) اختر مقالات تحتاج إثراء
  const need = [];
  for (const a of articles) {
    const key = a.sourceUrl || a.id;
    if (!key) continue;

    const fp = makeFingerprint(a);
    const hasAi = Boolean(a.aiTitle && String(a.aiTitle).trim().length > 0);
    const sameFp = String(a.aiFingerprint || "") === fp;

    if (hasAi && sameFp) continue; // جاهز
    need.push({ a, key, fp });
  }

  let enriched = 0;
  let skipped = 0;
  const toProcess = need.slice(0, MAX_ENRICH_PER_RUN);

  console.log(`AI restore applied: ${restored}`);
  console.log(`Need enrich: ${need.length} (processing up to ${toProcess.length})`);

  for (const item of toProcess) {
    const { a, key, fp } = item;

    try {
      const payload = await enrichOne(openai, a);

      // اكتب على المقال
      a.aiTitle = payload.aiTitle || a.aiTitle;
      a.aiSummary = payload.aiSummary || a.aiSummary;
      a.aiBody = payload.aiBody || a.aiBody;
      a.aiBullets = payload.aiBullets || a.aiBullets;
      a.aiTags = payload.aiTags || a.aiTags;

      a.aiModel = MODEL;
      a.aiDoneAt = new Date().toISOString();
      a.aiFingerprint = fp;

      // خزّن في الكاش
      cacheMap[key] = {
        fingerprint: fp,
        aiTitle: a.aiTitle || "",
        aiSummary: a.aiSummary || "",
        aiBody: a.aiBody || "",
        aiBullets: Array.isArray(a.aiBullets) ? a.aiBullets : [],
        aiTags: Array.isArray(a.aiTags) ? a.aiTags : [],
        aiModel: a.aiModel,
        aiDoneAt: a.aiDoneAt,
      };

      enriched++;
      console.log(`✅ enriched: ${key}`);
    } catch (e) {
      skipped++;
      console.log(`❌ enrich failed: ${key}`);
      console.log(String(e?.message || e));
    }

    // تهدئة بسيطة لتفادي الضغط
    await new Promise((r) => setTimeout(r, 700));
  }

  // اكتب النتائج
  writeJson(ARTICLES_PATH, articles);
  writeJson(AI_CACHE_PATH, cacheMap);
  writeJson(ENRICH_STAMP_PATH, {
    ok: true,
    restored,
    enriched,
    skipped,
    model: MODEL,
    at: new Date().toISOString(),
  });

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
