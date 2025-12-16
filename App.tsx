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
        const res = await fetch(`/articles.json?t=${Date.now()}`);
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

  // ✅ Primary vs Backfill
  const primaryArticles = useMemo(
    () => articles.filter((a: any) => (a.sourceTier || "primary") === "primary"),
    [articles]
  );
  const backfillArticles = useMemo(
    () => articles.filter((a: any) => a.sourceTier === "backfill"),
    [articles]
  );

  // ✅ Home: 12 من primary، وإن لم تكفِ نكمّل من backfill
  const homeArticles = useMemo(() => {
    const p = primaryArticles.slice(0, HOME_LIMIT);
    if (p.length >= HOME_LIMIT) return p;
    const need = HOME_LIMIT - p.length;
    return [...p, ...backfillArticles.slice(0, need)];
  }, [primaryArticles, backfillArticles]);

  // ✅ شريط الأخبار: عناوين من الرئيسية
  const tickerItems = useMemo(() => {
    return homeArticles.slice(0, 6).map((x) => ({ title: x.title }));
  }, [homeArticles]);

  // ✅ صفحة المقال
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
              ...selected,
              date: formatDate(selected.date) || selected.date,
            }}
            relatedArticles={related.map((r) => ({ ...r, date: formatDate(r.date) || r.date }))}
            onArticleClick={(a) => setSelected(a)}
          />
        </div>

        <Footer />
      </div>
    );
  }

  // ✅ الصفحة الرئيسية
  const featured = homeArticles[0];
  const rest = homeArticles.slice(1);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onHomeClick={() => setSelected(null)} />

      <NewsTicker items={tickerItems} secondsPerItem={7} />

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <p className="text-gray-700">جاري تحميل الأخبار…</p>
        ) : err ? (
          <p className="text-red-600">خطأ: {err}</p>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main */}
            <main className="w-full lg:w-2/3 flex flex-col gap-6">
              {featured ? (
                <div onClick={() => setSelected(featured)}>
                  <ArticleCard
                    article={{ ...featured, date: formatDate(featured.date) || featured.date }}
                    featured
                    onClick={() => setSelected(featured)}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {rest.map((a) => (
                  <div key={a.id || a.sourceUrl} onClick={() => setSelected(a)}>
                    <ArticleCard
                      article={{ ...a, date: formatDate(a.date) || a.date }}
                      onClick={() => setSelected(a)}
                    />
                  </div>
                ))}
              </div>
            </main>

            {/* Sidebar */}
            <aside className="w-full lg:w-1/3">
              <Sidebar
                articles={homeArticles.map((a) => ({ ...a, date: formatDate(a.date) || a.date }))}
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
