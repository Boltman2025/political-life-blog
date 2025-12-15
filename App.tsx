import { useEffect, useMemo, useState } from "react";

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr("");

        // ✅ نضيف ?t لمنع الكاش في المتصفح
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

  // ✅ الصفحة الرئيسية: 12 خبر فقط
  const homeArticles = useMemo(() => articles.slice(0, HOME_LIMIT), [articles]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>الحياة السياسية</h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          إجمالي محفوظ: {articles.length} • المعروض هنا: {homeArticles.length}
        </div>
      </header>

      <hr style={{ margin: "16px 0" }} />

      {loading ? (
        <p>جاري تحميل الأخبار…</p>
      ) : err ? (
        <p style={{ color: "crimson" }}>خطأ: {err}</p>
      ) : homeArticles.length === 0 ? (
        <p>لا توجد أخبار الآن.</p>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {homeArticles.map((a) => (
            <article
              key={a.id || a.sourceUrl}
              style={{
                border: "1px solid #eee",
                borderRadius: 14,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <a
                href={a.sourceUrl}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
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

                  <h2 style={{ margin: "8px 0 6px", fontSize: 16, lineHeight: 1.45 }}>
                    {a.title}
                  </h2>

                  {a.excerpt ? (
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, opacity: 0.9 }}>
                      {a.excerpt}
                    </p>
                  ) : null}

                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                    {a.author ? `المصدر: ${a.author}` : ""}
                  </div>
                </div>
              </a>
            </article>
          ))}
        </section>
      )}

      <footer style={{ marginTop: 24, fontSize: 12, opacity: 0.6 }}>
        ✅ الأداء الآن ثابت: تخزين 40 خبر فقط + عرض 12 في الرئيسية
      </footer>
    </div>
  );
}
