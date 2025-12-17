// scripts/enrich_ai.mjs
import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";
import * as cheerio from "cheerio";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ARTICLES_FILE = path.join(process.cwd(), "public", "articles.json");

const MAX_ENRICH_PER_RUN = Number(process.env.MAX_ENRICH_PER_RUN || "12");
const MODEL = process.env.OPENAI_MODEL || "gpt-5";
const REASONING_EFFORT = process.env.OPENAI_REASONING || "low";

const SECTIONS = ["الرئيسية", "وطني", "دولي", "اقتصاد", "مجتمع", "رياضة", "رأي"];

function safeText(x) {
  return String(x || "").replace(/\s+/g, " ").trim();
}

function hardTruncate(s, n) {
  const t = safeText(s);
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function pickSectionHeuristic(a) {
  const t = `${a.title || ""} ${a.excerpt || ""} ${a.content || ""}`;
  const has = (w) => t.includes(w);

  if (has("منتخب") || has("مباراة") || has("كرة") || has("الدوري") || has("بطولة")) return "رياضة";
  if (has("سعر") || has("أسعار") || has("دينار") || has("تضخم") || has("بنك") || has("استثمار") || has("نفط") || has("غاز"))
    return "اقتصاد";
  if (has("مدرسة") || has("تعليم") || has("صحة") || has("مستشفى") || has("طقس") || has("حوادث") || has("وفيات") || has("حرائق"))
    return "مجتمع";
  if (has("رأي") || has("افتتاحية") || has("تحليل") || has("وجهة نظر") || has("عمود")) return "رأي";
  if ((a.sourceTier || "").toLowerCase() === "dz") return "وطني";
  return "دولي";
}

function needsEnrich(a) {
  return !a.aiTitle || !a.aiSummary || !a.imageUrl;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept-Language": "ar-DZ,ar;q=0.9,fr-FR;q=0.7,fr;q=0.6,en;q=0.5",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function pickImageFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);

  const cand =
    safeText($(`meta[property="og:image"]`).attr("content")) ||
    safeText($(`meta[name="og:image"]`).attr("content")) ||
    safeText($(`meta[name="twitter:image"]`).attr("content")) ||
    safeText($(`meta[property="twitter:image"]`).attr("content"));

  const abs = (u) => {
    try {
      return new URL(u, baseUrl).toString();
    } catch {
      return "";
    }
  };

  if (cand) return abs(cand);

  // fallback: أول صورة “معقولة”
  const img = $("img")
    .map((_, el) => safeText($(el).attr("src")))
    .get()
    .find((u) => u && !u.startsWith("data:") && !u.includes("logo") && !u.includes("icon"));

  return img ? abs(img) : "";
}

async function enrichOne(a) {
  const sourceTitle = safeText(a.title);
  const sourceExcerpt = safeText(a.excerpt);
  const sourceContent = safeText(a.content);

  // 1) جلب صورة من المصدر (سريع)
  let imageUrl = "";
  try {
    const html = await fetchHtml(a.sourceUrl);
    imageUrl = pickImageFromHtml(html, a.sourceUrl);
  } catch {
    imageUrl = a.imageUrl || "";
  }

  // 2) طلب AI لعناوين أقوى + ملخص
  const payload = [
    `SOURCE TITLE: ${hardTruncate(sourceTitle, 220)}`,
    `SOURCE EXCERPT: ${hardTruncate(sourceExcerpt, 500)}`,
    `SOURCE CONTENT (may be empty): ${hardTruncate(sourceContent, 2000)}`,
    `SOURCE URL: ${safeText(a.sourceUrl)}`,
  ].join("\n");

  const instructions = `
أنت محرر أخبار عربي محترف. أنتج نسخة تحريرية عربية موجزة.
قواعد العنوان (مهم جدًا):
- 6 إلى 12 كلمة، قوي ومباشر، بدون مبالغة أو تهويل.
- تجنّب: "عاجل"، "حصري"، "صدمة"، "فضيحة".
- استخدم أفعال دقيقة: "يعلن"، "يؤكد"، "يناقش"، "يصادق"، "يقرر"، "يحذر".
- إذا كان الخبر جزائريًا اذكر "الجزائر" أو المؤسسة/الولاية عند الإمكان.
الملخص:
- 3 إلى 5 جمل.
- لا تضف أي معلومة غير موجودة في المصدر. إذا نقصت التفاصيل قل "بحسب المصدر".
القسم:
- اختر قسمًا واحدًا فقط من: ${SECTIONS.join("، ")}.
أعد JSON فقط بهذا الشكل:
{
  "title": "...",
  "summary": "...",
  "section": "..."
}
`;

  const resp = await client.responses.create({
    model: MODEL,
    reasoning: { effort: REASONING_EFFORT },
    instructions,
    input: payload,
  });

  const text = resp.output_text || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI did not return JSON");

  let obj;
  try {
    obj = JSON.parse(m[0]);
  } catch {
    throw new Error("Failed to parse AI JSON");
  }

  const aiTitle = safeText(obj.title);
  const aiSummary = safeText(obj.summary);
  const aiSectionRaw = safeText(obj.section);
  const section = SECTIONS.includes(aiSectionRaw) ? aiSectionRaw : pickSectionHeuristic(a);

  if (!aiTitle || !aiSummary) throw new Error("AI JSON missing fields");

  return { aiTitle, aiSummary, section, imageUrl: safeText(imageUrl) };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }

  const raw = await fs.readFile(ARTICLES_FILE, "utf-8");
  const articles = JSON.parse(raw);
  if (!Array.isArray(articles)) {
    console.error("articles.json is not an array");
    process.exit(1);
  }

  for (const a of articles) {
    if (!a.section) a.section = pickSectionHeuristic(a);
  }

  const targets = articles.filter(needsEnrich).slice(0, MAX_ENRICH_PER_RUN);
  console.log("AI enrich targets:", targets.length);

  let ok = 0;
  for (const a of targets) {
    try {
      const r = await enrichOne(a);
      a.aiTitle = r.aiTitle;
      a.aiSummary = r.aiSummary;
      a.section = r.section;
      if (r.imageUrl) a.imageUrl = r.imageUrl;

      ok++;
      console.log("✅ enriched:", a.sourceUrl);
    } catch (e) {
      console.log("❌ enrich failed:", a.sourceUrl, String(e?.message || e));
    }
  }

  await fs.writeFile(ARTICLES_FILE, JSON.stringify(articles, null, 2), "utf-8");
  console.log("DONE. Enriched:", ok);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
