import React, { useMemo } from "react";
import { Article } from "../types";

type Props = {
  articles: Article[];
};

function normalizeText(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeArticles(list: Article[]) {
  const seen = new Set<string>();
  const out: Article[] = [];

  for (const a of list) {
    // مفتاح قوي يمنع التكرار حتى لو تكرر نفس العنوان/الرابط
    const key =
      (a.sourceUrl && normalizeText(a.sourceUrl)) ||
      normalizeText(a.title) ||
      String(a.id);

    if (!key) continue;
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(a);
  }

  return out;
}

export function NewsTicker({ articles }: Props) {
  const items = useMemo(() => {
    const base = dedupeArticles(articles || []);

    // نأخذ آخر الأخبار (اختياري: يمكنك تغيير العدد)
    const top = base.slice(0, 12);

    // إذا عندك خبر واحد فقط، نعرضه مرة واحدة بدون loop مزعج
    return top;
  }, [articles]);

  if (!items.length) return null;

  // ✅ نكرر "القائمة كاملة" مرة ثانية فقط لصنع loop سلس
  // وليس تكرار خبر واحد
  const loop = items.length >= 2 ? [...items, ...items] : items;

  return (
    <div className="w-full bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 py-2">
          <span className="bg-[#ce1126] text-white text-sm font-bold px-3 py-1 rounded">
            عاجل
          </span>

          <div className="relative overflow-hidden flex-1">
            <div className="ticker-track">
              {loop.map((a, idx) => (
                <a
                  key={`${a.id ?? "a"}-${idx}`}
                  href={a.sourceUrl || "#"}
                  target={a.sourceUrl ? "_blank" : undefined}
                  rel={a.sourceUrl ? "noreferrer" : undefined}
                  className="ticker-item"
                  title={a.title}
                >
                  {a.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CSS داخلي لضمان أنه يعمل حتى لو ما عندك ملف CSS */}
      <style>{`
        .ticker-track {
          display: inline-flex;
          align-items: center;
          gap: 28px;
          white-space: nowrap;
          will-change: transform;
          animation: tickerMove 40s linear infinite;
        }

        .ticker-item {
          color: #111827;
          font-size: 14px;
          text-decoration: none;
        }

        .ticker-item:hover {
          text-decoration: underline;
        }

        @keyframes tickerMove {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        /* إذا لديك عنصر واحد فقط، نوقف الحركة حتى لا يبدو مكرر */
        @media (prefers-reduced-motion: reduce) {
          .ticker-track { animation: none; }
        }
      `}</style>
    </div>
  );
}
