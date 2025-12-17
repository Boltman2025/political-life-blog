// scripts/enrich_ai.mjs
import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ARTICLES_FILE = path.join(process.cwd(), "public", "articles.json");

// حدود تشغيل معقولة كل ساعة
const MAX_ENRICH_PER_RUN = Number(process.env.MAX_ENRICH_PER_RUN || "12");
const MODEL = process.env.OPENAI_MODEL || "gpt-5"; // أو gpt-4.1-mini… حسب ميزانيتك
const REASONING_EFFORT = process.env.OPENAI_REASONING || "low";

// أقسام الموقع
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

  // رياضة
  if (has("منتخب") || has("مباراة") || has("كرة") || has("الدوري") || has("بطولة")) return "رياضة";
  // اقتصاد
  if (has("سعر") || has("أسعار") || has("دينار") || has("تضخم") || has("بنك") || has("استثمار") || has("نفط") || has("غاز"))
    return "اقتصاد";
  // مجتمع
  if (has("مدرسة") || has("تعليم") || has("صحة") || has("مستشفى") || has("طقس") || has("حوادث") || has("وفيات") || has("حرائق"))
    return "مجتمع";
  // رأي
  if (has("رأي") || has("افتتاحية") || has("تحليل") || has("وجهة نظر") || has("عمود")) return "رأي";

  // محلي/وطني
  if ((a.sourceTier || "").toLowerCase() === "dz") return "وطني";

  return "دولي";
}

function needsEnrich(a) {
  // إذا عندنا aiSummary و aiTitle فهنا تم إثراؤه
  return !a.aiTitle || !a.aiSummary;
}

async function enrichOne(a) {
  const sourceTitle = safeText(a.title);
  const sourceExcerpt = safeText(a.excerpt);
  const sourceContent = safeText(a.content);

  // نعطي النموذج مادة كافية بدون الإطالة
  const payload = [
    `SOURCE TITLE: ${hardTruncate(sourceTitle, 220)}`,
    `SOURCE EXCERPT: ${hardTruncate(sourceExcerpt, 400)}`,
    `SOURCE CONTENT (may be empty): ${hardTruncate(sourceContent, 1800)}`,
    `SOURCE URL: ${safeText(a.sourceUrl)}`,
  ].join("\n");

  const instructions = `
أنت محرر أخبار عربي محترف. مهمتك إنتاج نسخة تحريرية عربية قصيرة وواضحة من خبر وارد.
قواعد إلزامية:
- اكتب بالعربية الفصحى المبسطة (أسلوب صحفي جزائري مفهوم).
- لا تنسخ نص المصدر حرفيًا. أعد الصياغة بوضوح وبأمانة.
- لا تضف معلومات غير موجودة. إذا نقصت التفاصيل قل "بحسب المصدر".
- العنوان قوي ومباشر، بدون مبالغة، 6 إلى 12 كلمة.
- لخص في 3 إلى 5 جمل.
- اقترح قسمًا واحدًا فقط من هذه: ${SECTIONS.join("، ")}.
- أعد JSON فقط بالهيكل المحدد.
`;

  // Responses API مثال رسمي :contentReference[oaicite:1]{index=1}
  const resp = await client.responses.create({
    model: MODEL,
    reasoning: { effort: REASONING_EFFORT },
    instructions,
    input: payload,
  });

  const text = resp.output_text || "";
  // نتوقع JSON. نحاول استخراج أول { ... }.
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI did not return JSON");

  let obj;
  try {
    obj = JSON.parse(m[0]);
  } catch {
    throw new Error("Failed to parse AI JSON");
  }

  // تطبيع خفيف
  const aiTitle = safeText(obj.title);
  const aiSummary = safeText(obj.summary);
  const aiSection = safeText(obj.section);

  if (!aiTitle || !aiSummary) throw new Error("AI JSON missing fields");

  const finalSection = SECTIONS.includes(aiSection) ? aiSection : pickSectionHeuristic(a);

  return {
    aiTitle,
    aiSummary,
    section: finalSection,
  };
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

  // جهّز قسم افتراضي إذا ناقص
  for (const a of articles) {
    if (!a.section) a.section = pickSectionHeuristic(a);
  }

  const targets = articles.filter(needsEnrich).slice(0, MAX_ENRICH_PER_RUN);

  console.log("AI enrich targets:", targets.length);

  let ok = 0;
  for (const a of targets) {
    try {
      const enriched = await enrichOne(a);

      a.aiTitle = enriched.aiTitle;
      a.aiSummary = enriched.aiSummary;
      a.section = enriched.section;

      // يمكن للواجهة أن تعرض aiTitle/aiSummary بدل الأصل
      ok++;
      console.log("✅ enriched:", a.sourceUrl);
    } catch (e) {
      console.log("❌ enrich failed:", a.sourceUrl, String(e?.message || e));
      // لا نوقف العملية على خبر واحد
    }
  }

  await fs.writeFile(ARTICLES_FILE, JSON.stringify(articles, null, 2), "utf-8");
  console.log("DONE. Enriched:", ok);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

