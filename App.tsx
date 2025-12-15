import { useEffect, useMemo, useState } from "react";
import * as HeaderMod from "./Header";
import * as SidebarMod from "./Sidebar";
import * as NewsTickerMod from "./NewsTicker";
import * as ArticleCardMod from "./ArticleCard";
import * as ArticleViewMod from "./ArticleView";
import * as FooterMod from "./Footer";
import { Article } from "./types";

const HOME_LIMIT = 12;

function pickComponent(mod: any, names: string[]) {
  if (mod?.default) return mod.default;
  for (const n of names) if (mod?.[n]) return mod[n];
  const anyExport = Object.values(mod || {}).find((v: any) => typeof v === "function");
  return anyExport || null;
}

export default function App() {
  const Header: any = pickComponent(HeaderMod, ["Header"]);
  const Sidebar: any = pickComponent(SidebarMod, ["Sidebar"]);
  const NewsTicker: any = pickComponent(NewsTickerMod, ["NewsTicker"]);
  const ArticleCard: any = pickComponent(ArticleCardMod, ["ArticleCard"]);
  const ArticleView: any = pickComponent(ArticleViewMod, ["ArticleView"]);
  const Footer: any = pickComponent(FooterMod, ["Footer"]);

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

  // ✅ تقسيم المقالات حسب tier
  const primaryArticles = useMemo(
    () => articles.filter((a: any) => (a.sourceTier || "primary") === "primary"),
    [articles]
  );
  const backfillArticles = useMemo(
    () => articles.filter((a: any) => a.sourceTier === "backfill"),
    [articles]
  );

  // ✅ الرئيسية: 12 من primary، وإذا لم تكفِ نكمل من backfill
  const homeArticles = useMemo(() => {
    const p = primaryArticles.slice(0, HOME_LIMIT);
    if (p.length >= HOME_LIMIT) return p;
    const need = HOME_LIMIT - p.length;
    return [...p, ...backfillArticles.slice(0, need)];
  }, [primaryArticles, backfillArticles]);

  const tickerItems = useMemo(() => {
    const src = homeArticles.slice(0, 6);
    return src.map((x) => ({ title: x.title }));
  }, [homeArticles]);

  if (selected && ArticleView) {
    return (
      <div>
        {Header ? <Header onHomeClick={() => setSelected(null)} /> : null}
        <div style={{ maxWidth: 1250, margin: "0 auto", padding: "14px 16px" }}>
          <ArticleView
            article={selected}
            relatedArticles={homeArticles.filter((x) => x.sourceUrl !== selected.sourceUrl).slice(0, 6)}
            onArticleClick={(a: Article) => setSelected(a)}
          />
        </div>
        {Footer ? <Footer /> : null}
      </div>
    );
  }

  return (
    <div>
      {Header ? <Header onHomeClick={() => setSelected(null)} /> : null}
      {NewsTicker ? <NewsTicker items={tickerItems} secondsPerItem={7} /> : null}

      <div style={{ maxWidth: 1250, margin: "0 auto", padding: "14px 16px" }}>
        {loading ? (
          <p>جاري تحميل الأخبار…</p>
        ) : err ? (
          <p style={{ color: "crimson" }}>خطأ: {err}</p>
        ) : homeArticles.length === 0 ? (
          <p>لا توجد أخبار الآن.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
            <main>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                {homeArticles.map((a) => (
                  <div key={a.id || a.sourceUrl} onClick={() => setSelected(a)} style={{ cursor: "pointer" }}>
                    {ArticleCard ? <ArticleCard article={a} onClick={() => setSelected(a)} /> : null}
                  </div>
                ))}
              </div>
            </main>

            <aside>
              {Sidebar ? (
                <Sidebar
                  articles={homeArticles}
                  onArticleClick={(a: Article) => setSelected(a)}
                />
              ) : null}
