import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ArticleCard } from './components/ArticleCard';
import { Footer } from './components/Footer';
import { Article, ViewState } from './types';

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Boltman2025/political-life-blog/main/data/articles.json';

export default function App() {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    const loadArticles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`${GITHUB_RAW_URL}?t=${Date.now()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setArticles(data);
          setDebugInfo(`✅ تم تحميل ${data.length} مقال`);
        } else {
          setArticles([]);
          setDebugInfo('❌ البيانات ليست مصفوفة');
        }
      } catch (err) {
        console.error('Error:', err);
        setError('تعذر تحميل المقالات');
        setDebugInfo(`❌ خطأ: ${err}`);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, []);

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
          <p className="text-gray-500 mt-2">{debugInfo}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-[#ce1126] text-white rounded-lg">
            🔄 إعادة المحاولة
          </button>
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
      
      {/* زر الفحص المدمج */}
      <div className="bg-yellow-100 border-r-4 border-yellow-500 p-4">
        <div className="flex justify-between items-center">
          <span className="font-bold">{debugInfo}</span>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-yellow-500 text-white rounded"
          >
            🔄 تحديث
          </button>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        {view === ViewState.HOME && renderHome()}
        {view === ViewState.ARTICLE && selectedArticle && (
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <button onClick={handleHomeClick} className="mb-4 px-4 py-2 bg-gray-200 rounded">
              ← عودة
            </button>
            <img src={selectedArticle.imageUrl} alt={selectedArticle.title} className="w-full h-96 object-cover rounded-lg mb-6" />
            <h1 className="text-4xl font-bold mb-4">{selectedArticle.title}</h1>
            <div className="flex gap-4 mb-6">
              <span className="px-3 py-1 bg-[#ce1126] text-white rounded-full text-sm">{selectedArticle.category}</span>
              <span className="text-gray-500">{selectedArticle.date}</span>
            </div>
            <div className="prose prose-lg max-w-none bg-white p-6 rounded-lg shadow">
              <p className="text-xl text-gray-700 mb-6">{selectedArticle.excerpt}</p>
              <div dangerouslySetInnerHTML={{ __html: selectedArticle.content.replace(/\n/g, '<br/>') }} />
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
