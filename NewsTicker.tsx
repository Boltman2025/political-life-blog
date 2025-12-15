import React, { useEffect, useMemo, useState } from "react";

type TickerItem = {
  title: string;
};

interface NewsTickerProps {
  items?: TickerItem[];
  secondsPerItem?: number; // افتراضي 7
}

export const NewsTicker: React.FC<NewsTickerProps> = ({
  items,
  secondsPerItem = 7,
}) => {
  const fallbackItems: TickerItem[] = [
    { title: "رئيس الجمهورية يستقبل وفداً دبلوماسياً رفيع المستوى..." },
    { title: "وزارة التجارة تعلن عن إجراءات جديدة لضبط الأسعار..." },
    { title: "المنتخب الوطني يواصل تحضيراته للمنافسات القادمة..." },
    { title: "افتتاح الصالون الدولي للكتاب بالجزائر العاصمة..." },
  ];

  const list = useMemo(() => {
    const arr = items && items.length ? items : fallbackItems;
    // نحذف الفارغ
    return arr.map((x) => ({ title: String(x?.title || "").trim() })).filter((x) => x.title);
  }, [items]);

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  // لو تغيرت القائمة، نرجع للبداية
  useEffect(() => {
    setIdx(0);
    setPhase("in");
  }, [list.length]);

  useEffect(() => {
    if (!list.length) return;

    const stayMs = secondsPerItem * 1000;
    const fadeMs = 350; // مدة fade out

    // بعد 7 ثواني نعمل خروج
    const t1 = window.setTimeout(() => setPhase("out"), stayMs - fadeMs);

    // ثم نبدل للجملة التالية ونرجع دخول
    const t2 = window.setTimeout(() => {
      setIdx((p) => (p + 1) % list.length);
      setPhase("in");
    }, stayMs);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [idx, list.length, secondsPerItem]);

  const text = list[idx]?.title || "";

  return (
    <div className="bg-[#ce1126] text-white py-2 relative z-40">
      <div className="container mx-auto px-4 flex items-center gap-4">
        <div className="bg-[#a30d1e] px-4 py-1 font-bold rounded-sm shadow-lg shrink-0">
          عاجل
        </div>

        {/* سطر واحد فقط */}
        <div className="flex-1 overflow-hidden">
          <div
            className={`ticker-line ${phase === "in" ? "ticker-in" : "ticker-out"}`}
            title={text}
          >
            {text}
          </div>
        </div>
      </div>

      <style>{`
        .ticker-line{
          white-space: nowrap;
          direction: rtl;
          text-overflow: ellipsis;
          overflow: hidden;
          font-weight: 700;
        }

        /* دخول من اليمين + Fade */
        .ticker-in{
          opacity: 1;
          transform: translateX(0);
          transition: opacity 350ms ease, transform 350ms ease;
          animation: slideIn 350ms ease;
        }

        /* خروج بسيط */
        .ticker-out{
          opacity: 0;
          transform: translateX(-20px);
          transition: opacity 350ms ease, transform 350ms ease;
        }

        @keyframes slideIn{
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};
