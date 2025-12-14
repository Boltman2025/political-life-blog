import React, { useEffect, useMemo, useState } from "react";
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

  for (const a of list || []) {
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

function isGoogleNews(a: Article) {
  const u = normalize(a.sourceUrl || "");
  return u.includes("news.google.com");
}

function isAlgeriaRelated(a: Article) {
  const t = normalize(a.title || "");
  const u = normalize(a.sourceUrl || "");
  const c = normalize((a as any).content || (a as any).excerpt || "");
  const hay = `${t} ${u} ${c}`;
  return hay.includes("الجزائر") || hay.includes("algeria") || hay.includes("dz");
}

export function NewsTicker({ articles }: Props) {
  const items = useMemo(() => {
    const unique = dedupe(articles);

    // ✅ ترتيب بالأولوية:
    // 1) Google News + الجزائر
    // 2) Google News
    // 3) الجزائر (من أي مصدر)
    // 4) الباقي
    const scored = unique
      .map((a) => {
        const g = isGoogleNews(a) ? 1 : 0;
        const dz = isAlgeriaRelated(a) ? 1 : 0;

        // أعلى رقم = أولوية أعلى
        // 300 = Google+DZ
        // 200 = Google
        // 100 = DZ
        // 0   = others
        const score = g && dz ? 300 : g ? 200 : dz ? 100 : 0;

        // دعم فرعي: الأحدث أولاً داخل نفس المجموعة
        const date =
          (a as any).date && !isNaN(new Date((a as any).date).getTime())
            ? new Date((a as any).date).getTime()
            : 0;

        return { a, score, date };
      })
      .sort((x, y) => {
        if (y.score !== x.score) return y.score - x.score;
        return y.date - x.date;
      })
      .map((x) => x.a);

    return scored.slice(0, 20); // خذ 20 خبر للشريط
  }, [articles]);

  const [idx, setIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  // ✅ كل 7 ثواني: Fade out -> تغيّر -> Fade in
  useEffect(() => {
    if (!items.length) return;

    const interval = setInterval(() => {
      setFadeIn(false); // fade out
      setTimeout(() => {
        setIdx((prev) => (prev + 1) % items.length);
        setFadeIn(true); // fade in
      }, 350); // زمن الاختفاء
    }, 7000);

    return () => clearInterval(interval);
  }, [items.length]);

  if (!items.length) return null;

  const current = items[idx];
  const href = current.sourceUrl || "#";

  return (
    <div className="w-full bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 py-2">
          <span className="bg-[#ce1126] text-white text-sm font-bold px-3 py-1 rounded">
            عاجل
          </span>

          <div className="flex-1 overflow-hidden">
            <a
              href={href}
              target={current.sourceUrl ? "_blank" : undefined}
              rel={current.sourceUrl ? "noreferrer" : undefined}
              className={`block w-full text-right font-bold text-[15px] text-gray-900 transition-opacity duration-300 ${
                fadeIn ? "opacity-100" : "opacity-0"
              }`}
              title={current.title}
            >
              {current.title}
            </a>

            {/* شارة صغيرة توضّح مصدر Google عند الحاجة */}
            {isGoogleNews(current) && (
              <div className="text-[11px] font-semibold text-gray-500 text-right mt-1">
                Google News
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
