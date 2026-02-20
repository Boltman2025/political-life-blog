import React, { useState, useEffect } from 'react';
import { Article } from '../types';

interface NewsTickerProps {
  articles: Article[];
}

export const NewsTicker: React.FC<NewsTickerProps> = ({ articles }) => {
  const [headlines, setHeadlines] = useState<string[]>([]);

  useEffect(() => {
    // استخراج العناوين من المقالات المتاحة
    if (articles && articles.length > 0) {
      const breakingNews = articles
        .filter(a => a.isBreaking === true)
        .map(a => a.title)
        .slice(0, 5);
      
      // إذا لم توجدBreaking news، خذ أول 5 مقالات
      const finalHeadlines = breakingNews.length > 0 
        ? breakingNews 
        : articles.slice(0, 5).map(a => a.title);
      
      setHeadlines(finalHeadlines);
    } else {
      // عناوين افتراضية
      setHeadlines([
        "مرحباً بكم في الحياة السياسية - منصة التحليل السياسي الجزائري",
        "مقالات يومية تلقائية بالذكاء الاصطناعي"
      ]);
    }
  }, [articles]);

  return (
    <div className="bg-[#ce1126] text-white py-2 overflow-hidden relative">
      <div className="container mx-auto px-4">
        <div className="flex items-center">
          <span className="bg-white text-[#ce1126] px-3 py-1 rounded font-bold ml-4 text-sm whitespace-nowrap z-10">
            ⚡ عاجل
          </span>
          <div className="flex-1 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap">
              {headlines.length > 0 ? (
                headlines.map((headline, index) => (
                  <span key={index} className="mx-8 inline-block text-sm md:text-base">
                    🔴 {headline}
                  </span>
                ))
              ) : (
                <span className="mx-8">جاري تحميل الأخبار...</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 25s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};
