// scripts/enrich_ai.mjs
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import OpenAI from "openai";

const ROOT = process.cwd();
const ARTICLES_PATH = path.join(ROOT, "public", "articles.json");

function safeString(v) {
  return (v ?? "").toString().trim();
}

function nowIso() {
  return new Date().toISOString();
}

// اختر نموذجك كما تريد
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function readArticles() {
  const raw = await fs.readFile(ARTICLES_PATH, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("public/articles.json must be an array of articles");
  }
  return data;
}

async function writeArticles(articles) {
  const out = JSON.stringify(articles, null, 2) + "\n";
  await fs.writeFile(ARTICLES_PATH, out, "utf-8");
}

function needsAI(a) {
  // عدّل هذا الشرط لو تحب
  return !safeString(a.aiTitle) || !safeString(a.aiSummary) || !safeString(a.aiBody);
}

function buildPrompt(a) {
  const title = safeString(a.title);
  const source = safeString(a.source);
  const url = safeString(a.url);
  const category = safeString(a.category);
  const publishedAt = safeString(a.publishedAt);
  const excerpt = safeString(a.excerpt || a.summary || "");

  // إن كان عندك content/fullText استعمله بدل excerpt
  const text = safeString(a.content || a.fullText || excerpt);

  return `
أنت محرر تحليلي بنبرة Think Tank جزائرية: محايد، دقيق، يشرح السياق دون تحريض.
أعطني JSON فقط (بدون أي نص إضافي) بهذه المفاتيح:
aiTitle (string)
aiSummary (string 2-4 جمل)
aiBody (string 4-8 فقرات قصيرة)
aiBullets (array 4-7 نقاط)
aiTags (array 5-10 كلمات)

قيود:
- ركّز على الجزائر أولاً إن كان الموضوع جزائريًا.
- لا تتبنّى رأيًا حزبياً.
- تجنّب المبالغة.
- إن كان النص ناقصًا/غير كافٍ: اكتب تحليلًا "متحفظًا" مع الإشارة لحدود المعطيات.

بيانات المقال:
title: ${title}
source: ${source}
url: ${url}
category: ${category}
publishedAt: ${publishedAt}
text: ${text}
`.trim();
}

async function enrichOne(article) {
  const prompt = buildPrompt(article);

  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: "Return ONLY valid JSON." },
      { role: "user", content: prompt },
    ],
  });

  const content = resp.choices?.[0]?.message?.content || "";
  let obj;
  try {
    obj = JSON.parse(content);
  } catch (e) {
    // محاولة إنقاذ بسيطة لو خرجت حواف أو نص إضافي
    const first = content.indexOf("{");
    const last = content.lastIndexOf("}");
    if (first >= 0 && last > first) obj = JSON.parse(content.slice(first, last + 1));
    else throw new Error("Model did not return valid JSON");
  }

  return {
    ...article,
    aiTitle: safeString(obj.aiTitle),
    aiSummary: safeString(obj.aiSummary),
    aiBody: safeString(obj.aiBody),
    aiBullets: Array.isArray(obj.aiBullets) ? obj.aiBullets.map(safeString).filter(Boolean) : [],
    aiTags: Array.isArray(obj.aiTags) ? obj.aiTags.map(safeString).filter(Boolean) : [],
    aiUpdatedAt: nowIso(),
  };
}

async function main() {
  console.log(`[enrich_ai] cwd=${ROOT}`);
  console.log(`[enrich_ai] articles path=${ARTICLES_PATH}`);

  const articles = await readArticles();
  console.log(`[enrich_ai] loaded articles=${articles.length}`);

  const targets = articles
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => needsAI(a));

  console.log(`[enrich_ai] needs enrichment=${targets.length}`);

  if (targets.length === 0) {
    console.log("[enrich_ai] nothing to do.");
    return;
  }

  let changed = 0;
  const updated = [...articles];

  for (const { a, idx } of targets) {
    try {
      console.log(`[enrich_ai] enriching #${idx} title="${safeString(a.title).slice(0, 80)}"`);
      const enriched = await enrichOne(a);

      // تأكيد أن فعلاً خرجت قيم
      if (safeString(enriched.aiTitle) || safeString(enriched.aiSummary) || safeString(enriched.aiBody)) {
        updated[idx] = enriched;
        changed++;
      } else {
        console.log(`[enrich_ai] WARNING: empty AI output for #${idx}, skipping write.`);
      }
    } catch (err) {
      console.log(`[enrich_ai] ERROR on #${idx}: ${err?.message || err}`);
      // لا نوقف البايبلاين على مقال واحد
    }
  }

  await writeArticles(updated);
  console.log(`[enrich_ai] wrote articles.json; changed=${changed}`);
}

main().catch((e) => {
  console.error("[enrich_ai] FATAL:", e);
  process.exit(1);
});
