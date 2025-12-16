import React, { useEffect, useMemo, useState } from "react";

type Props = {
  items?: string[];
  secondsPerItem?: number;
};

export const NewsTicker: React.FC<Props> = ({ items = [], secondsPerItem = 7 }) => {
  const clean = useMemo(() => items.filter(Boolean), [items]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (clean.length === 0) return;

    const ms = Math.max(2000, Number(secondsPerItem) * 1000);
    const t = setInterval(() => {
      setIdx((prev) => (prev + 1) % clean.length);
    }, ms);

    return () => clearInterval(t);
  }, [clean.length, secondsPerItem]);

  const title = clean.length ? clean[idx] : "…";

  return (
    <div className="bg-[#ce1126] text-white py-2 relative z-40">
      <div className="container mx-auto px-4 flex items-center gap-3">
        <div className="bg-[#a30d1e] px-3 py-1 font-bold shrink-0 rounded-sm">عاجل</div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="whitespace-nowrap animate-fadeSlide font-semibold">
            {title}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlide {
          0% { opacity: 0; transform: translateX(20px); }
          12% { opacity: 1; transform: translateX(0); }
          88% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(-20px); }
        }
        .animate-fadeSlide {
          animation: fadeSlide ${Math.max(2, Number(secondsPerItem))}s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
