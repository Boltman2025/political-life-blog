import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { NewsTicker } from './components/NewsTicker';
import { ArticleCard } from './components/ArticleCard';
import { Sidebar } from './components/Sidebar';
import { ArticleView } from './components/ArticleView';
import { Footer } from './components/Footer';
import { Article, ViewState } from './types';

// ⚙️ إعدادات GitHub API
const GITHUB_REPO = 'Boltman2025';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_REPO_NAME}/main/${ARTICLES_FILE}`;const ARTICLES_FILE = 'articles.json';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_REPO_NAME}/main/${ARTICLES_FILE}`;
export default function App() {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔄 تحميل المقالات من GitHub API مباشرة
  useEffect(() => {
    const loadArticles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // إضافة timestamp لمنع الكاش
        const cacheBuster = `?t=${new Date().getTime()}`;
        const response = await fetch(`${GITHUB_RAW_URL}${cacheBuster}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // التحقق من أن البيانات مصفوفة
        if (Array.isArray(data)) {
          setArticles(data);
        } else {
          console.warn('Data is not an array, using empty array');
          setArticles([]);
        }
      } catch (err) {
        console.error('Error loading articles from GitHub:', err);
        setError('تعذر تحميل المقالات. يرجى المحاولة لاحقاً.');
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, []);

  // 📜 التمرير للأعلى عند تغيير العرض
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, selectedArticle]);

  // 🖱️ معالجة النقر على مقال
  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
    setView(ViewState.ARTICLE);
  };

  // 🏠 العودة للرئيسية
  const handleHomeClick = () => {
    setView(ViewState.HOME);
    setSelectedArticle(null);
  };

  // 🏠 عرض الصفحة الرئيسية
  const renderHome = () => {
    // حالة: لا توجد مقالات
    if (articles.length === 0 && !loading) {
      return (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📰</div>
          <h2 className="text-2xl font-bold text-gray-700">
            {error || 'لا توجد مقالات حالياً'}
          </h2>
          <p className="text-gray-500 mt-2">
            {error 
              ? 'يرجى التحقق من اتصال الإنترنت أو المحاولة لاحقاً'
              : 'سيتم نشر أول مقال تلقائياً خلال 24 ساعة'}
          </p>
          {error && (
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-[#ce1126] text-white rounded-lg hover:bg-red-700 transition"
            >
              🔄 إعادة المحاولة
            </button>
          )}
        </div>
      );
    }

    const featured = articles[0];
    const latest = articles.slice(1, 5); // عرض آخر 4 مقالات فقط

    return (
      <div className="flex flex-col lg:flex-row gap-8">
        {/* المحتوى الرئيسي */}
        <main className="w-full lg:w-2/3">
          
          {/* المقال المميز */}
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4 border-r-4 border-[#ce1126] pr-3 text-gray-800">
              🔥 الحدث الرئيسي
            </h2>
            <ArticleCard 
              article={featured} 
              onClick={handleArticleClick} 
              featured={true} 
            />
          </div>

          {/* آخر الأخبار */}
          <div>
            <h2 className="text-xl font-bold mb-6 border-r-4 border-[#ce1126] pr-3 text-gray-800">
              📰 آخر الأخبار
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

        {/* الشريط الجانبي */}
        <Sidebar 
          articles={articles} 
          onArticleClick={handleArticleClick} 
        />
      </div>
    );
  };

  // ⏳ حالة التحميل
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#ce1126] mx-auto mb-4"></div>
          <div className="text-xl text-gray-600">جاري تحميل المحتوى...</div>
          <div className="text-sm text-gray-400 mt-2">يتم جلب المقالات من GitHub</div>
        </div>
      </div>
    );
  }

  // 🎨 العرض الرئيسي
  return (
    <div className="min-h-screen bg-[#f9fafb] text-gray-900 font-sans" dir="rtl">
      {/* الرأس */}
      <Header onHomeClick={handleHomeClick} />
      
      {/* شريط الأخبار */}
      <NewsTicker articles={articles} />
      
      {/* المحتوى */}
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

      {/* التذييل */}
      <Footer />
    </div>
  );
}
