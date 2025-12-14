import React, { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { NewsTicker } from "./components/NewsTicker";
import { ArticleCard } from "./components/ArticleCard";
import { Sidebar } from "./components/Sidebar";
import { ArticleView } from "./components/ArticleView";
import { Footer } from "./components/Footer";
import { Article, ViewState } from "./types";

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔄 تحميل المقالات من articles.json
  useEffect(() => {
    fetch("/articles.json", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setArticles(Array.isArray(data) ? data : []);
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  // ⬆️ Scroll للأعلى عند تغيير العرض
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, selectedArticle]);

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
    setView(ViewState.ARTICLE);
  };

  const handleHomeClick = () => {
    setSelectedArticle(null);
    setView(ViewState.HOME);
  };

  const renderHome = () => {
    if (!articles.length) {
      return (
        <div className="text-center text-gray-500 py-20">
          لا توجد مقالات متاحة حاليًا.
        </div>
      );
    }

    const featured = articles[0];
    const latest = articles.slice(1);

    return (
      <div className="flex flex-col lg:flex-row gap-8">
        <main className="w-full lg:w-2/3">
          {featured && (
            <div className="mb-10">
              <h2 className="text-xl font-bold mb-4 border-r-4 border-[#ce1126] pr-3 text-gray-800">
                الحدث الرئيسي
              </h2>
              <ArticleCard
                article={featured}
                onClick={handleArticleClick}
                featured
              />
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold mb-6 border-r-4 border-[#ce1126] pr-3 text-gray-800">
              آخر الأخبار
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {latest.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={handleArticleClick}
                />
              ))}
            </div>
          </div>
        </main>

        <Sidebar articles={articles} onArticleClick={handleArticleClick} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] text-gray-900 font-sans">
      <Header onHomeClick={handleHomeClick} />

      {/* 🟥 شريط الأخبار */}
      <NewsTicker articles={articles} />

      <div className="container mx-auto px-4 py-8">
        {loading && (
          <div className="text-center text-gray-500 py-20">
            جارٍ تحميل الأخبار…
          </div>
        )}

        {!loading && view === ViewState.HOME && renderHome()}

        {!loading && view === ViewState.ARTICLE && selectedArticle && (
          <ArticleView
            article={selectedArticle}
            relatedArticles={articles.filter(
              (a) => a.id !== selectedArticle.id
            )}
            onArticleClick={handleArticleClick}
          />
        )}
      </div>

      <Footer />
    </div>
  );
}
