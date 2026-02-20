import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { NewsTicker } from './components/NewsTicker';
import { ArticleCard } from './components/ArticleCard';
import { Sidebar } from './components/Sidebar';
import { ArticleView } from './components/ArticleView';
import { Footer } from './components/Footer';
import { Article, ViewState } from './types';

export default function App() {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  // تحميل المقالات من JSON
  useEffect(() => {
    const loadArticles = async () => {
      try {
        const response = await fetch('/data/articles.json');
        const data = await response.json();
        setArticles(data);
      } catch (error) {
        console.error('Error loading articles:', error);
        // استخدام بيانات افتراضية في حالة الخطأ
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, selectedArticle]);

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
    setView(ViewState.ARTICLE);
  };

  const handleHomeClick = () => {
    setView(ViewState.HOME);
    setSelectedArticle(null);
  };

  const renderHome = () => {
    if (articles.length === 0) {
      return (
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-gray-700">
            لا توجد مقالات حالياً
          </h2>
          <p className="text-gray-500 mt-2">
            سيتم نشر أول مقال قريباً...
          </p>
        </div>
      );
    }

    const featured = articles[0];
    const latest = articles.slice(1);

    return (
      <div className="flex flex-col lg:flex-row gap-8">
        <main className="w-full lg:w-2/3">
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4 border-r-4 border-[#ce1126] pr-3 text-gray-800">
              الحدث الرئيسي
            </h2>
            <ArticleCard 
              article={featured} 
              onClick={handleArticleClick} 
              featured={true} 
            />
          </div>

          <div>
            <h2 className="text-xl font-bold mb-6 border-r-4 border-[#ce1126] pr-3 text-gray-800">
              آخر الأخبار
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {latest.map(article => (
                <ArticleCard 
                  key={article.id} 
                  article={article} 
                  onClick={handleArticleClick} 
                />
              ))}
            </div>
          </div>
        </main>

        <Sidebar 
          articles={articles} 
          onArticleClick={handleArticleClick} 
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <div className="text-xl text-gray-600">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] text-gray-900 font-sans">
      <Header onHomeClick={handleHomeClick} />
      <NewsTicker />
      
      <div className="container mx-auto px-4 py-8">
        {view === ViewState.HOME && renderHome()}
        {view === ViewState.ARTICLE && selectedArticle && (
          <ArticleView 
            article={selectedArticle} 
            relatedArticles={articles.filter(a => a.id !== selectedArticle.id)}
            onArticleClick={handleArticleClick}
          />
        )}
      </div>

      <Footer />
    </div>
  );
}