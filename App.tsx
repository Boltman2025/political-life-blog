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

type SectionKey = "الكل" | "وطني" | "دولي" | "اقتصاد" | "مجتمع" | "رياضة" | "رأي";

function detectSection(a: any): SectionKey {
  const sec = String(a?.section || "").trim();
  if (sec === "وطني" || sec === "دولي" || sec === "اقتصاد" || sec === "مجتمع" || sec === "رياضة" || sec === "رأي")
    return sec as SectionKey;

  const cat = String(a?.category || "").trim();
  if (cat === "وطني" || cat === "دولي" || cat === "اقتصاد" || cat === "مجتمع" || cat === "رياضة" || cat === "رأي")
    return cat as SectionKey;

  const tags = Array.isArray(a?.aiTags) ? a.aiTags.join(" ") : "";
  const text = `${a?.aiTitle || a?.title || ""} ${a?.aiSummary || ""} ${tags}`.toLowerCase();

  // اقتصاد
  if (
    text.includes("اقتصاد") ||
    text.includes("مالية") ||
    text.includes("استثمار") ||
    text.includes("تضخم") ||
    text.includes("بنك") ||
    text.includes("نفط") ||
    text.includes("غاز") ||
    text.includes("طاقة") ||
    text.includes("تصدير") ||
    text.includes("استيراد") ||
    text.includes("ميزانية") ||
    text.includes("أسعار")
  ) return "اقتصاد";

  // رياضة
  if (
    text.includes("رياض") || text.includes("مباراة") || text.includes("بطولة") || text.includes("منتخب") ||
    text.includes("كرة القدم") || text.includes("الجزائر ضد") || text.includes("الدوري")
  ) return "رياضة";

  // مجتمع
  if (
    text.includes("مجتمع") || text.includes("تربية") || text.includes("تعليم") || text.includes("صحة") ||
    text.includes("حوادث") || text.includes("طقس") || text.includes("أمطار") || text.includes("ولايات")
  ) return "مجتمع";

  // رأي
  if (text.includes("رأي") || text.includes("تحليل") || text.includes("وجهة نظر") || text.includes("افتتاحية"))
    return "رأي";

  // دولي
  if (
    text.includes("دولي") ||
    text.includes("الأمم المتحدة") ||
    text.includes("مجلس الأمن") ||
    text.includes("الاتحاد الأوروبي") ||
    text.includes("واشنطن") ||
    text.includes("موسكو") ||
    text.includes("باريس") ||
    text.includes("بروكسل") ||
    text.includes("الشرق الأوسط") ||
    text.includes("غزة") ||
    text.includes("فلسطين") ||
    text.includes("سوريا") ||
    text.includes("ليبيا") ||
    text.includes("مالي") ||
    text.includes("النيجر") ||
    text.includes("تونس") ||
    text.includes("المغرب")
  ) return "دولي";

  if (isAlgeriaFocus(a)) return "وطني";
  return "دولي";
}

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [selected, setSelected] = useState<Article | null>(null);

  const [sectionFilter, setSectionFilter] = useState<SectionKey>("الكل");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setErr("");
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
    return () => { cancelled = true; };
  }, []);

  const primaryArticles = useMemo(() => {
    return articles.filter((a: any) => {
      const tier = String(a.sourceTier || "primary").toLowerCase();
      return tier === "primary" || tier === "dz";
    });
  }, [articles]);

  const sortedPrimary = useMemo(() => {
    const list = [...primaryArticles];
    list.sort((a: any, b: any) => timeMs(b) - timeMs(a));
    return list;
  }, [primaryArticles]);

  const homeArticles = useMemo(() => sortedPrimary.slice(0, HOME_LIMIT), [sortedPrimary]);

  const filteredHome = useMemo(() => {
    if (sectionFilter === "الكل") return homeArticles;
    return homeArticles.filter((a: any) => detectSection(a) === sectionFilter);
  }, [homeArticles, sectionFilter]);

  const getFeaturedScore = (a: any) => {
    let s = 0;
    if (a.aiTitle) s += 120;
    if (a.aiSummary) s += 80;
    if (a.aiBody) s += 60;

    const bulletsCount = Array.isArray(a.aiBullets) ? a.aiBullets.length : 0;
    const tagsCount = Array.isArray(a.aiTags) ? a.aiTags.length : 0;
    s += Math.min(bulletsCount, 7) * 10;
    s += Math.min(tagsCount, 10) * 4;

    if (String(a.section || "") === "وطني") s += 35;
    if (isAlgeriaFocus(a)) s += 35;

    if (!isAPN(a)) s += 25;
    if (a.imageUrl) s += 10;

    const t = timeMs(a);
    if (t > 0) s += Math.floor(t / 1e10);
    return s;
  };

  const featured = useMemo(() => {
    if (filteredHome.length === 0) return undefined;
    const sorted = [...filteredHome].sort((a: any, b: any) => getFeaturedScore(b) - getFeaturedScore(a));
    return sorted[0] || filteredHome[0];
  }, [filteredHome]);

  const rest = useMemo(() => {
    if (filteredHome.length === 0) return [];
    if (!featured) return filteredHome.slice(1);
    const fid = (featured as any).id || (featured as any).sourceUrl;
    return filteredHome.filter((x: any) => (x.id || x.sourceUrl) !== fid);
  }, [filteredHome, featured]);

  const tickerItems = useMemo(
    () => filteredHome.slice(0, 6).map((x: any) => x.aiTitle || x.title),
    [filteredHome]
  );

  const getRelated = (current: any) => {
    const currentId = current?.id || current?.sourceUrl;
    return homeArticles
      .filter((x: any) => (x.id || x.sourceUrl) !== currentId)
      .sort((a: any, b: any) => timeMs(b) - timeMs(a))
      .slice(0, 6);
  };

  // ✅ عند اختيار قسم من Header: ارجع للرئيسية وطبّق الفلتر
  const onSelectSection = (s: SectionKey) => {
    setSelected(null);
    setSectionFilter(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (selected) {
    const related = getRelated(selected);

    return (
      <div className="min-h-screen bg-gray-50">
        <Header
          onHomeClick={() => { setSelected(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          onSectionSelect={onSelectSection}
          activeSection={sectionFilter}
        />
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onHomeClick={() => { setSelected(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        onSectionSelect={onSelectSection}
        activeSection={sectionFilter}
      />
      <NewsTicker items={tickerItems} secondsPerItem={7} />

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <p className="text-gray-700">جاري تحميل الأخبار…</p>
        ) : err ? (
          <p className="text-red-600">خطأ: {err}</p>
        ) : filteredHome.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-800">
            لا توجد أخبار ضمن هذا القسم حاليًا (ضمن آخر {HOME_LIMIT} خبرًا من المصادر الأساسية).
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <main className="w-full lg:w-2/3 flex flex-col gap-6 min-w-0">
              {/* فلتر بسيط (موجود) */}
              <div className="flex gap-2 flex-wrap">
                {(["الكل","وطني","اقتصاد","دولي","مجتمع","رياضة","رأي"] as SectionKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSectionFilter(k)}
                    className={`px-3 py-1 rounded-full border text-sm ${
                      sectionFilter === k ? "bg-black text-white border-black" : "bg-white text-gray-800 border-gray-200"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

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
                articles={filteredHome.map((a: any) => ({
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
