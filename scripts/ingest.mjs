import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";

const OUT_FILE = path.join(process.cwd(), "public", "articles.json");

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function readJson(file) {
  try {
    const s = fs.readFileSync(file, "utf8");
    const j = JSON.parse(s);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function now() {
  return new Date().toISOString();
}

async function main() {
  console.log("=== DEBUG START ===");
  console.log("cwd:", process.cwd());
  console.log("OUT_FILE:", OUT_FILE);
  console.log("RSS_FEEDS:", process.env.RSS_FEEDS || "(empty)");
  console.log("MAX_ITEMS_PER_FEED:", process.env.MAX_ITEMS_PER_FEED);
  console.log("MAX_TOTAL_NEW:", process.env.MAX_TOTAL_NEW);

  const existing = readJson(OUT_FILE);
  console.log("existing articles:", existing.length);

  const feeds = (process.env.RSS_FEEDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // إذا ماكانش RSS أو فشل.. نكتب مقالة تجريبية حتى نضمن أن الكتابة تعمل
  const fallbackArticle = {
    id: `debug_${Date.now()}`,
    title: "مقال تجريبي (Debug)",
    excerpt: "هذا مقال تجريبي للتأكد أن GitHub Actions يكتب في public/articles.json",
    content: "إذا ظهر هذا المقال في الموقع، فالمشكلة ليست في Vercel بل في روابط RSS أو parsing.",
    category: "Debug",
    author: "System",
    date: now(),
    imageUrl: "https://picsum.photos/800/600?random=999",
    sourceUrl: "debug://local",
    isBreaking: true
  };

  const parser = new Parser({ timeout: 20000 });
  let added = [];

  for (const url of feeds) {
    try {
      console.log("Fetching:", url);
      const feed = await parser.parseURL(url);
      console.log("Feed title:", feed.title);
      console.log("Items:", (feed.items || []).length);

      const items = (feed.items || []).slice(0, Number(process.env.MAX_ITEMS_PER_FEED || 5));
      for (const it of items) {
        const link = it.link || it.guid || "";
        const title = (it.title || "").trim();
        const content = (it.contentSnippet || it.content || it.summary || "").toString().trim();

        if (!link || !title) continue;

        added.push({
          id: `${Date.now()}_${added.length}`,
          title,
          excerpt: content.replace(/\s+/g, " ").slice(0, 180),
          content,
          category: "أخبار",
          author: feed.title || "RSS",
          date: now(),
          imageUrl: `https://picsum.photos/800/600?random=${Math.floor(Math.random()*1000)}`,
          sourceUrl: link,
          isBreaking: false
        });
      }
    } catch (e) {
      console.log("RSS FAILED:", url, String(e?.message || e));
    }
  }

  const maxTotal = Number(process.env.MAX_TOTAL_NEW || 8);
  added = added.slice(0, maxTotal);

  if (added.length === 0) {
    console.log("No RSS items fetched. Writing fallback debug article.");
    added = [fallbackArticle];
  }

  const merged = [...added, ...existing].slice(0, 80);
  writeJson(OUT_FILE, merged);

  console.log("WROTE articles:", merged.length);
  console.log("=== DEBUG END ===");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
