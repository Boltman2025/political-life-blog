import React, { useEffect, useMemo, useState } from "react";
import type { Article } from "../types";

type Props = {
  articles?: Article[];
  maxItems?: number;
};

function isBreakingByDate(isoLike: string) {
  // يعتبر الخبر عاجلًا إذا كان خلال آخر 6 ساعات
  const t = new Date(isoLike).getTime();
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  return now - t <= 6 * 60 * 60 * 1000;
}

export const NewsTicker: React.FC<Props> = ({ articles = [], maxItems = 8 }) => {
  const items = useMemo(() => {
    const sorted = [...articles].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // ✅ أولاً: الأخبار الموسومة isBreaking
    const breaking = sorted.filter((a) => a.isBreaking);

    // ✅ ثانيًا: إذا لا يوجد isBreaking، اعتبر "عاجل" حسب التاريخ (آخر 6 ساعات)
    const autoBreaking = sorted.filter((a) => !a.isBreaking && isBreakingByDate(a.date));

    // ✅ ثم أكمل بباقي الأحدث
    const rest = sorted.filter(
      (a) => !breaking.some((x) => x.id === a.id) && !autoBreaking.some((x) => x.id === a.id)
    );

    const merged = [...breaking, ...autoBreaking, ...rest].slice(0, maxItems);

    return merged.map((a) => ({
      id: a.id,
      text: a.title,
      tag: a.isBreaking || isBreakingByDate(a.date) ? "عاجل" : "آخر الأخبار",
    }));
  }, [articles, maxItems]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!items.length) return;
    setIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;

  const current = items[index];

  return (
    <div className="w-full bg-white border-b">
      <div className="container mx-auto px-4 py-2 flex items-center gap-3">
        <span className="shrink-0 bg-[#ce1126] text-white text-sm font-bold px-3 py-1 rounded">
          {current.tag}
        </span>

        <div className="relative overflow-hidden flex-1">
          <div
            key={current.id}
            className="whitespace-nowrap text-gray-800 font-semibold animate-[ticker_12s_linear_infinite]"
            title={current.text}
          >
            {current.text}
            <span className="mx-6 text-gray-300">•</span>
            {current.text}
            <span className="mx-6 text-gray-300">•</span>
            {current.text}
          </div>
        </div>
      </div>

      {/* Tailwind keyframes inline عبر style tag */}
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-40%); }
        }
      `}</style>
    </div>
  );
};
