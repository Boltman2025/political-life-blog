import React, { useMemo } from "react";
import { Article } from "../types";

type Props = {
  articles: Article[];
};

function normalize(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(list: Article[]) {
  const seen = new Set<string>();
  const out: Article[] = [];

  for (const a of list) {
    const key =
      normalize(a.sourceUrl || "") ||
      normalize(a.title || "") ||
      String(a.id);

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }

  return out;
}

export function NewsTicker({ articles }: Props) {
  const items = useMemo(() => {
    const unique = dedupe(articles || []);
    return unique.slice(0, 12);
  }, [articles]);

  if (!items.length) return null;

  // نكرر القائمة كاملة مرتين لضمان دوران لا نهائي
  const loop = items.length > 1 ? [...items, ...items] : items;

  return (
    <div className="w-full bg-white border-b border-gray-200 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 py-2">
          <span className="bg-[#ce1126] text-white text-sm font-bold px-3 py-1 rounded">
            عاجل
          </span>

          <div className="relative overflow-hidden flex-1">
            <div className="ticker-track">
              {loop.map((a, idx) => (
                <a
                  key={`${a.id}-${idx}`}
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

      {/* CSS داخلي مضبوط */}
      <style>{`
        .ticker-track {
          display: inline-flex;
          align-items: center;
          gap: 36px;
          white-space: nowrap;
          animation: tickerRTL 45s linear infinite;
        }

        /* 🔁 من اليسار إلى اليمين */
        @keyframes tickerRTL {
          from {
            transform: translateX(-50%);
          }
          to {
            transform: translateX(0);
          }
        }

        .ticker-item {
          font-weight: 700; /* BOLD */
          font-size: 15px;
          color: #111827;
          text-decoration: none;
        }

        .ticker-item:hover {
          text-decoration: underline;
        }

        /* إذا خبر واحد فقط → نوقف الحركة */
        .ticker-track:has(.ticker-item:only-child) {
          animation: none;
        }
      `}</style>
    </div>
  );
}
