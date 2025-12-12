import fs from "fs";
import Parser from "rss-parser";
import OpenAI from "openai";

const parser = new Parser();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FEEDS = (process.env.RSS_FEEDS || "").split(",").map(s => s.trim()).filter(Boolean);
const STYLE = process.env.EDITORIAL_STYLE || "صحفي احترافي";
const OUTPUT = "public/articles.json";
const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || 3);
const MAX_TOTAL_NEW = Number(process.env.MAX_TOTAL_NEW || 6);

const existing = fs.existsSync(OUTPUT)
  ? JSON.parse(fs.readFileSync(OUTPUT, "utf8"))
  : [];

const existingSourceUrls = new Set(existing.map(a => a.sourceUrl).filter(Boolean));

function safeText(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

async function rewriteToArticle(item) {
  const sourceTitle = safeText(item.title);
  const sourceLink = item.link || "";
  const sourceSnippet = safeText(item.contentSnippet);
  const sourceContent = safeText(item.content);

  const prompt = `
أنت صحفي محترف في موقع جزائري اسمه "الحياة السياسية".
الأسلوب: ${STYLE}

مهمتك:
- اكتب عنوانًا جديدًا قويًا ودقيقًا (بدون تهويل).
- اكتب ملخصًا (سطرين إلى ثلاثة) يصلح كـ excerpt.
- اكتب نصًا صحفيًا احترافيًا ومحايدًا، مع الحفاظ على المعنى دون نسخ حرفي.
- لا تختلق معلومات غير موجودة.
- اختم بسطر: "المصدر: [اسم المصدر إن أمكن]" ثم ضع رابط المصدر.

أخرج النتيجة في JSON فقط بالشكل التالي (ولا تكتب أي شيء خارج JSON):
{
  "title": "",
  "excerpt": "",
  "content": "",
  "category": "وطني",
  "author": "هيئة التحرير"
}

بيانات الخبر:
- العنوان الأصلي: ${sourceTitle}
- الملخص: ${sourceSnippet}
- نص إضافي: ${sourceContent}
- الرابط: ${sourceLink}
`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  const json = JSON.parse(res.choices[0].message.content);

  return {
    id: String(Date.now()) + Math.floor(Math.random() * 1000),
    title: json.title,
    excerpt: json.excerpt,
    content: `${json.content}\n\nالمصدر: ${sourceLink}`,
    category: json.category || "وطني",
    author: json.author || "هيئة التحرير",
    date: new Date().toLocaleDateString("ar-DZ"),
    imageUrl: "https://picsum.photos/800/600?random=" + Math.floor(Math.random() * 10000),
    sourceUrl: sourceLink
  };
}

(async () => {
  if (FEEDS.length === 0) {
    console.log("No RSS feeds provided.");
    process.exit(0);
  }

  const newArticles = [];

  for (const url of FEEDS) {
    const feed = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

    for (const item of items) {
      if (newArticles.length >= MAX_TOTAL_NEW) break;
      if (!item?.link) continue;
      if (existingSourceUrls.has(item.link)) continue;

      try {
        const article = await rewriteToArticle(item);
        newArticles.push(article);
      } catch (e) {
        console.log("Failed on item:", item?.link, e?.message || e);
      }
    }
  }

  if (newArticles.length === 0) {
    console.log("No new articles generated.");
    process.exit(0);
  }

  const merged = [...newArticles, ...existing];
  fs.writeFileSync(OUTPUT, JSON.stringify(merged, null, 2));
  console.log("Updated:", OUTPUT, "New:", newArticles.length);
})();

