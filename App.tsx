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

const isAPN = (a: Article) =>
  (a.sourceUrl || "").toLowerCase().includes("apn.dz");

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

  // ✅ Primary فقط في الرئيسية (إذا ما كانش sourceTier نعتبره primary)
  const primaryArticles = useMemo(
    () => articles.filter((a: any) => ((a.sourceTier || "primary") === "primary")),
    [articles]
  );

  // ✅ الرئيسية: 12 فقط
  const homeArticles = useMemo(() => primaryArticles.slice(0, HOME_LIMIT), [primaryArticles]);

  // ✅ featured ذكي: يفضل غير APN + وطني + عنده صورة + الأحدث
  const getFeaturedScore = (a: any) => {
    let s = 0;
    if (!isAPN(a)) s += 50;
    if ((a.section || "") === "وطني") s += 30;
    if (a.imageUrl) s += 20;
    const t = a.date ? new Date(a.date).getTime() : 0;
    s += Math.floor(t / 1e9);
    return s;
  };

  const featured = useMemo(() => {
    if (homeArticles.length === 0) return undefined;
    const sorted = [...homeArticles].sort((a: any, b: any) => getFeaturedScore(b) - getFeaturedScore(a));
    return sorted[0] || homeArticles[0];
  }, [homeArticles]);

  const rest = useMemo(() => {
    if (!featured) return homeArticles.slice(1);
    const fid = (featured as any).id || featured.sourceUrl;
    return homeArticles.filter((x: any) => ((x.id || x.sourceUrl) !== fid));
  }, [homeArticles, featured]);

  // ✅ التِكَر: عناوين من نفس homeArticles (يفضل aiTitle)
  const tickerItems = useMemo(
    () =>
      homeArticles
        .slice(0, 6)
        .map((x: any) => x.aiTitle || x.title),
    [homeArticles]
  );

  if (selected) {
    const related = homeArticles
      .filter((x) => x.sourceUrl !== selected.sourceUrl)
      .slice(0, 6);

    return (
      <div className="min-h-screen bg-gray-50">
        <Header onHomeClick={() => setSelected(null)} />
        <div className="container mx-auto px-4 py-6">
          <ArticleView
            article={{
              ...(selected as any),
              title: (selected as any).aiTitle || selected.title,
              excerpt: (selected as any).aiSummary || (selected as any).excerpt,
              date: formatDate((selected as any).date) || (selected as any).date
            }}
            relatedArticles={related.map((r: any) => ({
              ...r,
              title: r.aiTitle || r.title,
              excerpt: r.aiSummary || r.excerpt,
              date: formatDate(r.date) || r.date
            }))}
            onArticleClick={(a) => setSelected(a)}
          />
        </div>
        <Footer />
      </div>
    );
  }

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
            لا توجد أخبار حديثة من المصادر الأساسية (Primary) ضمن آخر فترة التصفية.
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
                      date: formatDate((featured as any).date) || (featured as any).date
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
                        date: formatDate(a.date) || a.date
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
                  date: formatDate(a.date) || a.date
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
