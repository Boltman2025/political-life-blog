import React, { useState, useEffect } from 'react';

type Article = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  date: string;
  imageUrl: string;
  isBreaking: boolean;
  readTime: string;
  url: string;
  keyPoints: string[];
  impact: string;
};

type ViewState = 'HOME' | 'ARTICLE';

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Boltman2025/political-life-blog/main/data/articles.json';

export default function App() {
  const [view, setView] = useState<ViewState>('HOME');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('جاري تحميل الأخبار الحية...');

  useEffect(() => {
    const loadLiveNews = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${GITHUB_RAW_URL}?t=${Date.now()}`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        console.log('📰 أخبار حية محملة:', data.length);
        
        if (Array.isArray(data)) {
          setArticles(data);
          setDebugInfo(`🔴 أخبار حية: ${data.length} خبر | آخر تحديث: ${new Date().toLocaleString('ar-DZ')}`);
        }
      } catch (err: any) {
        setDebugInfo(`❌ خطأ: ${err.message}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadLiveNews();
    const interval = setInterval(loadLiveNews, 2 * 60 * 1000); // تحديث كل دقيقتين
    return () => clearInterval(interval);
  }, []);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'اقتصاد': 'bg-green-600', 'دولي': 'bg-blue-600', 
      'مجتمع': 'bg-purple-600', 'سياسة': 'bg-red-600'
    };
    return colors[category] || 'bg-gray-600';
  };

  const renderHome = () => (
    <div className="space-y-12">
      {/* Breaking News */}
      {articles.slice(0, 2).map(article => (
        <div key={article.id} className="bg-gradient-to-r from-red-50 to-orange-50 p-8 rounded-3xl border-r-8 border-red-500">
          <div className="flex flex-col lg:flex-row gap-8">
            <img src={article.imageUrl} alt={article.title} className="w-full lg:w-96 h-64 object-cover rounded-2xl flex-shrink-0" />
            <div className="flex-1">
              <div className="flex gap-3 mb-4">
                <span className={`px-4 py-2 ${getCategoryColor(article.category)} text-white rounded-full font-bold`}>
                  {article.category}
                </span>
                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold">🚨 فوري</span>
              </div>
              <h2 className="text-3xl font-black mb-4 leading-tight hover:text-red-600 cursor-pointer" 
                  onClick={() => handleArticleClick(article)}>
                {article.title}
              </h2>
              <p className="text-xl text-gray-700 mb-6">{article.excerpt}</p>
              <div className="flex gap-4 text-sm">
                <span>{article.date}</span>
                <a href={article.url} target="_blank" className="text-blue-600 hover:underline font-bold">
                  المصدر →
                </a>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* باقي الأخبار */}
      <section>
        <h2 className="text-3xl font-bold mb-8 border-b-4 border-gray-300 pb-4">📰 آخر الأخبار</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.slice(2).map(article => (
            <div key={article.id} className="group hover:shadow-2xl transition-all duration-300 rounded-3xl overflow-hidden bg-white" 
                 onClick={() => handleArticleClick(article)}>
              <img src={article.imageUrl} alt={article.title} className="w-full h-56 object-cover group-hover:scale-105 transition-transform" />
              <div className="p-6">
                <span className={`px-3 py-1 ${getCategoryColor(article.category)} text-white rounded-full text-sm font-bold mb-3 inline-block`}>
                  {article.category}
                </span>
                <h3 className="font-bold text-xl mb-3 line-clamp-2 group-hover:text-red-600">{article.title}</h3>
                <p className="text-gray-600 mb-4 line-clamp-2">{article.excerpt}</p>
                <div className="flex justify-between items-center text-sm">
                  <span>{article.readTime}</span>
                  <a href={article.url} target="_blank" className="text-blue-600 font-bold hover:underline">
                    المصدر
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
    setView('ARTICLE');
  };

  const handleHomeClick = () => {
    setView('HOME');
    setSelectedArticle(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-red-500 border-t-transparent mx-auto mb-6"></div>
          <div className="text-2xl font-bold text-red-600">{debugInfo}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 text-gray-900" dir="rtl">
      {/* شريط الحالة الحي */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-2xl p-4">
        <div className="container mx-auto flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="font-bold text-xl">
            🚨 <span className="font-mono bg-white text-red-600 px-3 py-1 rounded-full">{debugInfo}</span>
          </div>
          <button onClick={() => window.location.reload()} 
                  className="px-6 py-2 bg-white text-red-600 rounded-xl font-bold hover:shadow-lg">
            🔄 تحديث حي
          </button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12 lg:px-12 lg:py-20 max-w-7xl">
        {view === 'HOME' ? renderHome() : selectedArticle && (
          <div className="max-w-4xl mx-auto">
            <button onClick={handleHomeClick} className="mb-12 px-8 py-3 bg-white shadow-lg hover:shadow-xl rounded-2xl font-bold flex items-center gap-3">
              ← العودة للأخبار الحية
            </button>
            
            <article className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              <img src={selectedArticle.imageUrl} alt={selectedArticle.title} className="w-full h-[400px] object-cover" />
              <div className="p-12">
                <div className="flex gap-4 mb-6">
                  <span className={`px-5 py-2 ${getCategoryColor(selectedArticle.category)} text-white rounded-full font-bold text-lg`}>
                    {selectedArticle.category}
                  </span>
                  <span className="text-2xl font-bold text-gray-700">{selectedArticle.date}</span>
                </div>
                
                <h1 className="text-4xl lg:text-5xl font-black mb-8 leading-tight">{selectedArticle.title}</h1>
                
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                  <div>
                    <h3 className="text-2xl font-bold mb-4 text-gray-800">📋 النقاط الرئيسية:</h3>
                    <ul className="space-y-2 text-lg">
                      {selectedArticle.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="bg-red-500 text-white w-6 h-6 rounded-full flex-shrink-0 mt-1 font-bold text-sm flex items-center justify-center">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-4 text-gray-800">💥 التأثير على الجزائر:</h3>
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 p-6 rounded-2xl">
                      <p className="text-xl leading-relaxed">{selectedArticle.impact}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-3xl mb-8">
                  <div dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 items-center pt-8 border-t">
                  <a href={selectedArticle.url} target="_blank" 
                     className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 flex-1 text-center">
                    🔗 اقرأ المقال الأصلي
                  </a>
                  <span className="text-gray-600 font-medium">{selectedArticle.readTime} قراءة</span>
                </div>
              </div>
            </article>
          </div>
        )}
      </div>

      <footer className="bg-gradient-to-r from-red-700 to-orange-600 text-white py-12 mt-24">
        <div className="container mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold mb-4">نظام مراقبة الأخبار الجزائرية الحية</h3>
          <p className="text-xl">وكالة الأنباء الجزائرية + Google News • تحديث كل دقيقتين 🚨</p>
        </div>
      </footer>
    </div>
  );
}
