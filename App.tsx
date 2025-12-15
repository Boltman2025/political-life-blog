import { useEffect, useMemo, useState } from "react";

// ✅ استيراد “مرن” (يشتغل سواء كان export default أو export named)
import * as HeaderMod from "./Header";
import * as SidebarMod from "./Sidebar";
import * as NewsTickerMod from "./NewsTicker";
import * as ArticleCardMod from "./ArticleCard";
import * as ArticleViewMod from "./ArticleView";
import * as FooterMod from "./Footer";

type Article = {
  id?: string;
  title: string;
  excerpt?: string;
  content?: string;
  category?: string;
  author?: string;
  date?: string;
  imageUrl?: string;
  sourceUrl: string;
  isBreaking?: boolean;
  editorialStyle?: string;
};

const HOME_LIMIT = 12;

function pickComponent(mod: any, fallbackNames: string[]) {
  // 1) default export
  if (mod?.default) return mod.default;
  // 2) named export بأسماء شائعة
  for (const n of fallbackNames) {
    if (mod?.[n]) return mod[n];
  }
  // 3) آخر حل: أول قيمة دالة/مكوّن داخل الموديول
  const anyExport = Object.values(mod || {}).find((v: any) => typeof v === "function");
  return anyExport || null;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ar-DZ", { year: "numeric", month: "2-digit", day: "2-digit" });
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

  // ✅ عرض 12 فقط
  const homeArticles = useMemo(() => articles.slice(0, HOME_LIMIT), [articles]);

  // ✅ ticker items (إن وُجد)
  const tickerItems = useMemo(() => {
    const breaking = articles.filter((a) => a.isBreaking);
    return breaking.length ? breaking : homeArticles.slice(0, 6);
  }, [articles, homeArticles]);

  // ✅ View (إن كنت تستعمله)
  if (selected && ArticleView) {
    return (
      <div>
        {Header ? <Header /> : null}

        <div style={{ maxWidth: 1250, margin: "0 auto", padding: "14px 16px" }}>
          <button
            onClick={() => setSelected(null)}
            style={{
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginBottom: 12,
            }}
          >
            ← رجوع
          </button>

          <ArticleView article={selected} />
        </div>

        {Footer ? <Footer /> : null}
      </div>
    );
  }

  return (
    <div>
      {Header ? <Header /> : null}

      {NewsTicker ? <NewsTicker items={tickerItems} /> : null}

      <div style={{ maxWidth: 1250, margin: "0 auto", padding: "14px 16px" }}>
        <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 10 }}>
          إجمالي محفوظ: {articles.length} • المعروض في الرئيسية: {homeArticles.length}
        </div>

        {loading ? (
          <p>جاري تحميل الأخبار…</p>
        ) : err ? (
          <p style={{ color: "crimson" }}>خطأ: {err}</p>
        ) : homeArticles.length === 0 ? (
          <p>لا توجد أخبار الآن.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 320px",
              gap: 18,
              alignItems: "start",
            }}
          >
            <main>
              {/* إذا عندك ArticleCard نستعمله (واجهة قديمة)، وإلا fallback بسيط */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 16,
                }}
              >
                {homeArticles.map((a) => (
                  <div
                    key={a.id || a.sourceUrl}
                    onClick={() => (ArticleView ? setSelected(a) : window.open(a.sourceUrl, "_blank"))}
                    style={{ cursor: "pointer" }}
                  >
                    {ArticleCard ? (
                      <ArticleCard article={a} />
                    ) : (
                      <article
                        style={{
                          border: "1px solid #eee",
                          borderRadius: 14,
                          overflow: "hidden",
                          background: "#fff",
                        }}
                      >
                        {a.imageUrl ? (
                          <img
                            src={a.imageUrl}
                            alt={a.title}
                            loading="lazy"
                            style={{ width: "100%", height: 170, objectFit: "cover" }}
                          />
                        ) : null}
                        <div style={{ padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, opacity: 0.75 }}>
                            <span>{a.category || "أخبار"}</span>
                            <span>{formatDate(a.date)}</span>
                          </div>
                          <h2 style={{ margin: "8px 0 6px", fontSize: 16, lineHeight: 1.45 }}>{a.title}</h2>
                          {a.excerpt ? (
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, opacity: 0.9 }}>{a.excerpt}</p>
                          ) : null}
                          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>{a.author ? `المصدر: ${a.author}` : ""}</div>
                        </div>
                      </article>
                    )}
                  </div>
                ))}
              </div>
            </main>

            <aside>
              {/* Sidebar (إن وُجد) — نمرر أقل شيء ممكن لتجنب كسر props */}
              {Sidebar ? <Sidebar /> : null}
            </aside>
          </div>
        )}
      </div>

      {Footer ? <Footer /> : null}
    </div>
  );
}
