// scripts/ingest.mjs
import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import OpenAI from "openai";

const ROOT = process.cwd();
const OUT_FILE = path.join(ROOT, "public", "articles.json");

function toInt(v, def) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : def;
}

function nowDateAr() {
  try {
    return new Intl.DateTimeFormat("ar-DZ", { dateStyle: "full" }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

function safeReadJson(filePath) {
  try {
    const s = fs.readFileSync(filePath, "utf8");
    const j = JSON.parse(s);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function safeWriteJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeItem(item) {
  const link = item.link || item.guid || "";
  const title = (item.title || "").trim();
  const content =
    (item.contentSnippet || item.content || item.summary || "").toString().trim();

  return {
    link,
    title,
    content,
  };
}

async function rewriteWithAI({ title, content, style }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });

  const prompt = `
أنت ${style || "صحفي احترافي"}.
المطلوب:
- أعد صياغة العنوان بشكل جديد جذّاب مع الحفاظ على المعنى.
- أعد كتابة الخبر بأسلوب عربي فصيح (بدون كذب أو إضافة معلومات غير موجودة).
- اختصره إلى 6-10 فقرات قصيرة.
- أضف فقرة أخيرة بعنوان: "قراءة سريعة" تتضمن 3 نقاط نقدية أو تحليلية قصيرة (إن أمكن)، وإن لم يمكن اكتفِ بتلخيص محايد.

العنوان الأصلي:
${title}

المحتوى الأصلي:
${content}
`.trim();

  const r = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const text = r.output_text?.trim();
  if (!text) return null;

  // نضع أول سطر كعنوان جديد إذا أمكن
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const newTitle = lines[0] && lines[0].length <= 120 ? lines[0] : title;
  const newBody = lines.slice(1).join("\n").trim() || text;

  return { newTitle, newBody };
}

async function main() {
  const feedsEnv = (process.env.RSS_FEEDS || "").trim();
  const feeds = feedsEnv
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const maxPerFeed = toInt(process.env.MAX_ITEMS_PER_FEED, 5);
  const maxTotal = toInt(process.env.MAX_TOTAL_NEW, 8);
  const style = (process.env.EDITORIAL_STYLE || "صحفي احترافي").trim();

  if (feeds.length === 0) {
    console.log("No RSS_FEEDS provided. Writing [] and exit.");
    safeWriteJson(OUT_FILE, []);
    return;
  }

  const parser = new Parser({
    timeout: 20000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AutoPublisher/1.0; +https://github.com/)",
    },
  });

  const existing = safeReadJson(OUT_FILE);
  const existingLinks = new Set(existing.map(a => a?.sourceUrl).filter(Boolean));

  const collected = [];

  for (const url of feeds) {
    try {
      console.log("Fetching RSS:", url);
      const feed = await parser.parseURL(url);
      const items = (feed.items || []).slice(0, maxPerFeed);

      for (const raw of items) {
        const n = normalizeItem(raw);
        if (!n.link || !n.title) continue;
        if (existingLinks.has(n.link)) continue;

        collected.push({
          sourceUrl: n.link,
          sourceName: feed.title || "RSS",
          title: n.title,
          content: n.content || "",
        });
      }
    } catch (e) {
      console.log("RSS failed:", url, String(e?.message || e));
    }
  }

  // قصّ العدد للحد الأعلى
  const picked = collected.slice(0, maxTotal);

  const finalArticles = [];
  for (let i = 0; i < picked.length; i++) {
    const item = picked[i];

    let title = item.title;
    let content = item.content;

    // محاولة AI (اختيارية) — إذا فشل نكمل عادي
    try {
      const ai = await rewriteWithAI({ title, content, style });
      if (ai) {
        title = ai.newTitle;
        content = ai.newBody;
      }
    } catch (e) {
      console.log("AI rewrite failed:", String(e?.message || e));
    }

    finalArticles.push({
      id: `${Date.now()}_${i}`,
      title,
      excerpt: (content || "").replace(/\s+/g, " ").slice(0, 180),
      content: content || "",
      category: "أخبار",
      author: item.sourceName || "مصدر",
      date: nowDateAr(),
      imageUrl: `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 1000)}`,
      sourceUrl: item.sourceUrl,
      isBreaking: i === 0
    });
  }

  const merged = [...finalArticles, ...existing].slice(0, 80);
  safeWriteJson(OUT_FILE, merged);

  console.log("Done. Added:", finalArticles.length, "Total now:", merged.length);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
