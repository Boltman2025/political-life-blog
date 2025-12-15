import React from "react";
import { Article } from "./types";

interface SidebarProps {
  articles: Article[];
  onArticleClick: (article: Article) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ articles, onArticleClick }) => {
  const trending = articles.slice(0, 4);

  return (
    <aside className="w-full lg:w-1/3 flex flex-col gap-8">
      {/* Social Box */}
      <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
        <h3 className="text-lg font-bold mb-4 border-r-4 border-[#ce1126] pr-3">
          تابعنا
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button className="bg-[#1877f2] text-white py-2 rounded-sm text-sm font-bold hover:opacity-90">
            Facebook
          </button>
          <button className="bg-[#1da1f2] text-white py-2 rounded-sm text-sm font-bold hover:opacity-90">
            Twitter
          </button>
          <button className="bg-[#ff0000] text-white py-2 rounded-sm text-sm font-bold hover:opacity-90">
            Youtube
          </button>
          <button className="bg-[#e4405f] text-white py-2 rounded-sm text-sm font-bold hover:opacity-90">
            Instagram
          </button>
        </div>
      </div>

      {/* Most Read / Trending */}
      <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
        <h3 className="text-lg font-bold mb-6 border-r-4 border-[#ce1126] pr-3">
          الأكثر قراءة
        </h3>
        <div className="flex flex-col gap-6">
          {trending.map((article, idx) => (
            <div
              key={article.id || article.sourceUrl || `${idx}`}
              onClick={() => onArticleClick(article)}
              className="flex gap-4 group cursor-pointer"
            >
              <span className="text-3xl font-black text-gray-200 group-hover:text-[#ce1126] transition-colors leading-none">
                {idx + 1}
              </span>
              <div>
                <h4 className="font-bold text-gray-800 text-sm leading-snug group-hover:text-[#ce1126] transition-colors">
                  {article.title}
                </h4>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Newsletter */}
      <div className="bg-gray-900 text-white p-6 rounded-lg">
        <h3 className="text-lg font-bold mb-2">النشرة البريدية</h3>
        <p className="text-gray-400 text-sm mb-4">
          اشترك للحصول على آخر الأخبار السياسية يومياً.
        </p>
        <input
          type="email"
          placeholder="البريد الإلكتروني"
          className="w-full p-2 mb-2 text-gray-900 rounded-sm focus:outline-none"
        />
        <button className="w-full bg-[#ce1126] py-2 font-bold rounded-sm hover:bg-[#b00e20] transition-colors">
          اشترك
        </button>
      </div>
    </aside>
  );
};
