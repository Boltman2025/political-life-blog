import Parser from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "political-life-blog-feed-check/1.0" },
});

const RSS_FEEDS = String(process.env.RSS_FEEDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  if (!RSS_FEEDS.length) {
    console.log("RSS_FEEDS empty.");
    process.exit(0);
  }

  console.log("Total feeds:", RSS_FEEDS.length);
  console.log("====================================");

  let ok = 0;
  let bad = 0;

  for (const url of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      const title = (feed.title || "").toString().trim();
      const count = Array.isArray(feed.items) ? feed.items.length : 0;

      console.log("✅ OK:", url);
      console.log("   title:", title || "(no title)");
      console.log("   items:", count);

      // اعرض أول 2 عناوين فقط
      (feed.items || []).slice(0, 2).forEach((it, i) => {
        console.log(`   - ${i + 1}) ${(it.title || "").toString().trim()}`);
      });

      console.log("------------------------------------");
      ok++;
    } catch (e) {
      console.log("❌ FAIL:", url);
      console.log("   reason:", String(e?.message || e));
      console.log("------------------------------------");
      bad++;
    }
  }

  console.log("====================================");
  console.log("RESULT => OK:", ok, "FAIL:", bad);
}

main();
