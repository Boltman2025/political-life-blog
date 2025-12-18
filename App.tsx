import { useEffect, useMemo, useState } from "react";
import { Article } from "./types";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { NewsTicker } from "./NewsTicker";
import { ArticleCard } from "./ArticleCard";
import { ArticleView } from "./ArticleView";
import { Footer } from "./Footer";

const HOME_LIMIT = 12;

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ar-DZ", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const isAPN = (a: Article) => (a.sourceUrl || "").toLowerCase().includes("apn.dz");

function timeMs(a: any) {
  const t = a?.date || a?.publishedAt || a?.pubDate;
  const ms = Date.parse(t || "");
  return Number.isFinite(ms) ? ms : 0;
}

// ✅ Heuristic: هل المقال جزائري/وطني؟
function isAlgeriaFocus(a: any) {
  const section = String(a?.section || "").toLowerCase();
  const category = String(a?.category || "").toLowerCase();
  const title = String(a?.aiTitle || a?.title || "").toLowerCase();
  const summary = String(a?.aiSummary || "").toLowerCase();
  const combined = `${section} ${category} ${title} ${summary}`;

  return (
    section.includes("وطني") ||
    category.includes("وطني") ||
    combined.includes("الجزائر") ||
    combined.includes("جزائري") ||
    combined.includes("الجزائرية")
  );
}

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [selected, setSelected] = useState<Article | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr("");

        // ✅ no-store + ?t لمنع أي كاش
        const res = await fetch(`/articles.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load articles.json (${res.status})`);

        const data = await res.json();
        const arr = Array.isArray(data) ? (data as Article[]) : [];

        if (!cancelled) setArticles(arr);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ اعتبر dz + primary "مصادر أساسية"
  const primaryArticles = useMemo(() => {
    return articles.filter((a: any) => {
      const tier = String(a.sourceTier || "primary").toLowerCase();
      return tier === "primary" || tier === "dz";
    });
  }, [articles]);

  // ✅ تأكيد ترتيب الأحدث أولاً (أساسي لFeatured/التكر)
  const sortedPrimary = useMemo(() => {
    const list = [...primaryArticles];
    list.sort((a: any, b: any) => timeMs(b) - timeMs(a));
    return list;
  }, [primaryArticles]);

  // ✅ الرئيسية: 12 فقط (بعد الفرز)
  const homeArticles = useMemo(() => sortedPrimary.slice(0, HOME_LIMIT), [sortedPrimary]);

  // ✅ featured ذكي (Think Tank): يفضل AI + وطني/جزائري + غير APN + الأحدث
  const getFeaturedScore = (a: any) => {
    let s = 0;

    // 1) AI presence = أهم معيار
    if (a.aiTitle) s += 120;
    if (a.aiSummary) s += 80;
    if (a.aiBody) s += 60;

    const bulletsCount = Array.isArray(a.aiBullets) ? a.aiBullets.length : 0;
    const tagsCount = Array.isArray(a.aiTags) ? a.aiTags.length : 0;
    s += Math.min(bulletsCount, 7) * 10; // حتى 70
    s += Math.min(tagsCount, 10) * 4;    // حتى 40

    // 2) الجزائر/وطني
    if (String(a.section || "") === "وطني") s += 35;
    if (isAlgeriaFocus(a)) s += 35;

    // 3) كسر هيمنة APN
    if (!isAPN(a)) s += 25;

    // 4) صورة (مكمل)
    if (a.imageUrl) s += 10;

    // 5) الأحدث (وزن صغير، لأننا أصلاً فرزنا)
    const t = timeMs(a);
    if (t > 0) s += Math.floor(t / 1e10); // رقم صغير يعتمد على الزمن

    return s;
  };

  const featured = useMemo(() => {
    if (homeArticles.length === 0) return undefined;

    // ✅ نختار من آخر 12 فقط، لكنه حسب سكور Think Tank
    const sorted = [...homeArticles].sort((a: any, b: any) => getFeaturedScore(b) - getFeaturedScore(a));
    return sorted[0] || homeArticles[0];
  }, [homeArticles]);

  const rest = useMemo(() => {
    if (!featured) return homeArticles.slice(1);
    const fid = (featured as any).id || (featured as any).sourceUrl;
    return homeArticles.filter((x: any) => (x.id || x.sourceUrl) !== fid);
  }, [homeArticles, featured]);

  // ✅ التِكَر: عناوين من نفس homeArticles (يفضل aiTitle)
  const tickerItems = useMemo(
    () => homeArticles.slice(0, 6).map((x: any) => x.aiTitle || x.title),
    [homeArticles]
  );

  // ✅ صفحة المقال
  if (selected) {
    const related = homeArticles.filter((x) => x.sourceUrl !== selected.sourceUrl).slice(0, 6);

    return (
      <div className="min-h-screen bg-gray-50">
        <Header onHomeClick={() => setSelected(null)} />
        <div className="container mx-auto px-4 py-6">
          <ArticleView
            article={{
              ...(selected as any),
              title: (selected as any).aiTitle || (selected as any).title,
              excerpt: (selected as any).aiSummary || (selected as any).excerpt,
              date: formatDate((selected as any).date) || (selected as any).date,
            }}
            relatedArticles={related.map((r: any) => ({
              ...r,
              title: r.aiTitle || r.title,
              excerpt: r.aiSummary || r.excerpt,
              date: formatDate(r.date) || r.date,
            }))}
            onArticleClick={(a) => setSelected(a)}
          />
        </div>
        <Footer />
      </div>
    );
  }

  // ✅ الرئيسية
  return (
    <div className="min-h-screen bg-gray-50">
      <Header onHomeClick={() => setSelected(null)} />
      <NewsTicker items={tickerItems} secondsPerItem={7} />

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <p className="text-gray-700">جاري تحميل الأخبار…</p>
        ) : err ? (
          <p className="text-red-600">خطأ: {err}</p>
        ) : homeArticles.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-800">
            لا توجد أخبار حديثة من المصادر الأساسية (Primary/DZ) ضمن آخر فترة التصفية.
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <main className="w-full lg:w-2/3 flex flex-col gap-6 min-w-0">
              {featured ? (
                <div onClick={() => setSelected(featured)}>
                  <ArticleCard
                    article={{
                      ...(featured as any),
                      title: (featured as any).aiTitle || (featured as any).title,
                      excerpt: (featured as any).aiSummary || (featured as any).excerpt,
                      date: formatDate((featured as any).date) || (featured as any).date,
                    }}
                    featured
                    onClick={() => setSelected(featured)}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {rest.map((a: any) => (
                  <div key={a.id || a.sourceUrl} onClick={() => setSelected(a)}>
                    <ArticleCard
                      article={{
                        ...a,
                        title: a.aiTitle || a.title,
                        excerpt: a.aiSummary || a.excerpt,
                        date: formatDate(a.date) || a.date,
                      }}
                      onClick={() => setSelected(a)}
                    />
                  </div>
                ))}
              </div>
            </main>

            <aside className="w-full lg:w-1/3">
              <Sidebar
                articles={homeArticles.map((a: any) => ({
                  ...a,
                  title: a.aiTitle || a.title,
                  excerpt: a.aiSummary || a.excerpt,
                  date: formatDate(a.date) || a.date,
                }))}
                onArticleClick={(a) => setSelected(a)}
              />
            </aside>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
