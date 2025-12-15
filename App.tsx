import { useEffect, useMemo, useState } from "react";

// ✅ استدعاء مكوّنات الواجهة السابقة الموجودة عندك
import HeaderCmp from "./Header";
import SidebarCmp from "./Sidebar";
import NewsTickerCmp from "./NewsTicker";
import ArticleCardCmp from "./ArticleCard";
import ArticleViewCmp from "./ArticleView";
import FooterCmp from "./Footer";

// ✅ نكسر قيود TypeScript على props (حتى لا تتوقف بسبب اختلاف التواقيع)
const Header: any = HeaderCmp;
const Sidebar: any = SidebarCmp;
const NewsTicker: any = NewsTickerCmp;
const ArticleCard: any = ArticleCardCmp;
const ArticleView: any = ArticleViewCmp;
const Footer: any = FooterCmp;

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

        // ✅ منع الكاش
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

  // ✅ عرض 12 فقط في الرئيسية
  const homeArticles = useMemo(() => articles.slice(0, HOME_LIMIT), [articles]);

  // ✅ شريط عاجل (إن وُجد)
  const breaking = useMemo(() => articles.filter((a) => a.isBreaking), [articles]);

  // ✅ “الأكثر قراءة” للسايدبار (نأخذ من المتاح)
  const mostRead = useMemo(() => articles.slice(0, 8), [articles]);

  // ✅ لو داخل صفحة خبر (مشاهدة)، نعرض ArticleView
  if (selected) {
    return (
      <div>
        <Header />
        <div style={{ maxWidth: 1250, margin: "0 auto", padding: "14px 16px" }}>
          {/* زر رجوع بسيط بدون تغيير تصميمك الأصلي */}
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

          {/* ArticleView موجود عندك (نمرر article كما هو) */}
          <ArticleView article={selected} />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      {/* ✅ الواجهة السابقة: Header */}
      <Header />

      {/* ✅ الواجهة السابقة: Ticker */}
      {breaking.length > 0 ? <NewsTicker items={breaking} /> : <NewsTicker items={homeArticles.slice(0, 5)} />}

      <div style={{ maxWidth: 1250, margin: "0 auto", padding: "14px 16px" }}>
        {/* ✅ سطر معلومات خفيف (اختياري) */}
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
            {/* ✅ عمود الأخبار */}
            <main>
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
                    onClick={() => setSelected(a)}
                    style={{ cursor: "pointer" }}
                    title="اضغط لفتح الخبر"
                  >
                    {/* ✅ نستعمل ArticleCard الموجود عندك */}
                    <ArticleCard article={a} />
                  </div>
                ))}
              </div>

              {/* ✅ زر “المزيد” اختياري (يفتح أول خبر ليس المحدد، أو يمكن أن تربطه بصفحة لاحقاً) */}
              {articles.length > HOME_LIMIT ? (
                <div style={{ marginTop: 16 }}>
                  <button
                    onClick={() => setSelected(articles[HOME_LIMIT] || null)}
                    style={{
                      cursor: "pointer",
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      background: "#fff",
                    }}
                  >
                    المزيد
                  </button>
                </div>
              ) : null}
            </main>

            {/* ✅ السايدبار بالواجهة السابقة */}
            <aside>
              <Sidebar mostRead={mostRead} formatDate={formatDate} />
            </aside>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
