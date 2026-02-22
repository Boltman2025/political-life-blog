import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { NewsTicker } from './components/NewsTicker';
import { ArticleCard } from './components/ArticleCard';
import { Sidebar } from './components/Sidebar';
import { ArticleView } from './components/ArticleView';
import { Footer } from './components/Footer';
import { Article, ViewState } from './types';

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Boltman2025/political-life-blog/main/data/articles.json';

export default function App() {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadArticles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const cacheBuster = `?t=${new Date().getTime()}`;
        const response = await fetch(`${GITHUB_RAW_URL}${cacheBuster}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          console.log('✅ المقالات المحملة:', data); // للـ Console
          setArticles(data);
        } else {
          setArticles([]);
        }
      } catch (err) {
        console.error('❌ خطأ:', err);
        setError('تعذر تحميل المقالات');
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
    if (articles.length === 0 && !loading) {
      return (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📰</div>
          <h2 className="text-2xl font-bold text-gray-700">{error || 'لا توجد مقالات'}</h2>
          <p className="text-gray-500 mt-2">{error ? 'أعد المحاولة' : 'سيتم النشر قريباً'}</p>
          {error && (
            <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-[#ce1126] text-white rounded-lg">
              🔄 إعادة المحاولة
            </button>
          )}
        </div>
      );
    }

    const featured = articles[0];
    const latest = articles.slice(1, 5);

    return (
      <div className="flex flex-col lg:flex-row gap-8">
        <main className="w-full lg:w-2/3">
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4 border-r-4 border-[#ce1126] pr-3">🔥 الحدث الرئيسي</h2>
            <ArticleCard article={featured} onClick={handleArticleClick} featured={true} />
          </div>

          <div>
            <h2 className="text-xl font-bold mb-6 border-r-4 border-[#ce1126] pr-3">📰 آخر الأخبار</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {latest.map(article => (
                <ArticleCard key={article.id} article={article} onClick={handleArticleClick} />
              ))}
            </div>
          </div>
        </main>

        <Sidebar articles={articles} onArticleClick={handleArticleClick} />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#ce1126] mx-auto mb-4"></div>
          <div className="text-xl text-gray-600">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] text-gray-900 font-sans" dir="rtl">
      <Header onHomeClick={handleHomeClick} />
      <NewsTicker articles={articles} />
      
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
