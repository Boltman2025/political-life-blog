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
};

type ViewState = 'HOME' | 'ARTICLE';

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Boltman2025/political-life-blog/main/data/articles.json';

export default function App() {
  const [view, setView] = useState<ViewState>('HOME');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState('جاري التحميل...');

  // تصنيفات المدعومة
  const CATEGORIES = ['اقتصاد', 'دولي', 'مجتمع', 'سياسة'];

  useEffect(() => {
    const loadArticles = async () => {
      try {
        setLoading(true);
        setError(null);
        setDebugInfo('🔄 جاري تحميل المقالات من GitHub...');
        
        const cacheBuster = Date.now();
        const response = await fetch(`${GITHUB_RAW_URL}?t=${cacheBuster}`);
        
        if (!response.ok) {
          throw new Error(`خطأ HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📊 بيانات JSON المستلمة:', data);
        
        if (Array.isArray(data) && data.length > 0) {
          // التحقق من الصور
          const articlesWithImages = data.map((article: Article) => ({
            ...article,
            imageUrl: article.imageUrl || 'https://images.pexels.com/photos/1591060/pexels-photo-1591060.jpeg?w=800&h=600&fit=crop'
          }));
          
          setArticles(articlesWithImages);
          setDebugInfo(`✅ تم تحميل ${data.length} مقال | ${data[0]?.category || 'غير محدد'}`);
          console.log('✅ المقالات محملة:', articlesWithImages.slice(0, 3));
        } else {
          throw new Error('البيانات فارغة أو غير صحيحة');
        }
      } catch (err: any) {
        console.error('❌ خطأ التحميل:', err);
        setError(`خطأ: ${err.message}`);
        setDebugInfo(`❌ فشل التحميل: ${err.message}`);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
    
    // تحديث كل 5 دقائق
    const interval = setInterval(loadArticles, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleArticleClick = (article: Article) => {
    console.log('📖 فتح مقال:', article.title);
    setSelectedArticle(article);
    setView('ARTICLE');
  };

  const handleHomeClick = () => {
    setView('HOME');
    setSelectedArticle(null);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'اقتصاد': 'bg-green-600',
      'دولي': 'bg-blue-600', 
      'مجتمع': 'bg-purple-600',
      'سياسة': 'bg-red-600'
    };
    return colors[category] || 'bg-gray-600';
  };

  const renderHome = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#ce1126]"></div>
          <p className="mt-4 text-lg text-gray-600">{debugInfo}</p>
        </div>
      );
    }

    if (articles.length === 0) {
      return (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📰</div>
          <h2 className="text-3xl font-bold text-red-600 mb-4">{error || 'لا توجد مقالات'}</h2>
          <p className="text-lg mb-6">{debugInfo}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-8 py-3 bg-[#ce1126] text-white rounded-lg font-bold text-lg hover:bg-red-700"
          >
            🔄 تحديث فوري
          </button>
        </div>
      );
    }

    const featured = articles[0];
    const latest = articles.slice(1, 5);

    return (
      <div className="space-y-12">
        {/* الحدث الرئيسي */}
        <section>
          <h2 className="text-2xl font-bold mb-6 border-r-4 border-[#ce1126] pr-4 inline-block">
            🔥 الحدث الرئيسي
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-black mb-6 leading-tight">{featured.title}</h1>
              <p className="text-xl text-gray-700 mb-6">{featured.excerpt}</p>
              <div className="flex gap-4 mb-8">
                <span className={`px-4 py-2 ${getCategoryColor(featured.category)} text-white rounded-full font-bold`}>
                  {featured.category}
                </span>
                <span className="text-gray-500 font-medium">{featured.date} • {featured.readTime}</span>
              </div>
              <button 
                onClick={() => handleArticleClick(featured)}
                className="px-8 py-3 bg-[#ce1126] text-white rounded-lg font-bold hover:bg-red-700"
              >
                اقرأ المقال كاملاً
              </button>
            </div>
            <img 
              src={featured.imageUrl} 
              alt={featured.title}
              className="w-full h-96 lg:h-[500px] object-cover rounded-2xl shadow-2xl"
              onError={(e) => {
                console.log('صورة فشلت:', featured.imageUrl);
                (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/1591060/pexels-photo-1591060.jpeg?w=800&h=600';
              }}
            />
          </div>
        </section>

        {/* آخر الأخبار */}
        <section>
          <h2 className="text-2xl font-bold mb-8 border-r-4 border-[#ce1126] pr-4 inline-block">
            📰 آخر الأخبار
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {latest.map(article => (
              <article key={article.id} className="group cursor-pointer" onClick={() => handleArticleClick(article)}>
                <div className="relative overflow-hidden rounded-2xl mb-4 h-48">
                  <img 
                    src={article.imageUrl} 
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/1591060/pexels-photo-1591060.jpeg?w=800&h=600';
                    }}
                  />
                </div>
                <span className={`px-3 py-1 ${getCategoryColor(article.category)} text-white rounded-full text-sm font-bold mb-2 inline-block`}>
                  {article.category}
                </span>
                <h3 className="font-bold text-xl group-hover:text-[#ce1126] mb-2 leading-tight">{article.title}</h3>
                <p className="text-gray-600 mb-4 line-clamp-2">{article.excerpt}</p>
                <span className="text-sm text-gray-500">{article.readTime} قراءة</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white text-gray-900" dir="rtl">
      {/* شريط Debug الأصفر الواضح */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 border-b-4 border-yellow-500 p-3 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="font-bold text-lg">
            <span className="mr-2">🔍 حالة النظام:</span>
            <span className="font-mono bg-white px-2 py-1 rounded text-green-800 font-bold">{debugInfo}</span>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg font-bold hover:bg-yellow-700 flex items-center gap-2"
          >
            🔄 تحديث فوري
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 lg:px-8 lg:py-16 max-w-7xl">
        {view === 'HOME' && renderHome()}
        
        {view === 'ARTICLE' && selectedArticle && (
          <article className="max-w-4xl mx-auto">
            <button 
              onClick={handleHomeClick} 
              className="mb-8 px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-bold flex items-center gap-2"
            >
              ← العودة للرئيسية
            </button>
            
            <img 
              src={selectedArticle.imageUrl} 
              alt={selectedArticle.title}
              className="w-full h-[400px] md:h-[500px] object-cover rounded-3xl shadow-2xl mb-8"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/1591060/pexels-photo-1591060.jpeg?w=1200&h=600';
              }}
            />
            
            <header>
              <div className="flex gap-4 mb-6">
                <span className={`px-4 py-2 ${getCategoryColor(selectedArticle.category)} text-white rounded-full font-bold text-lg`}>
                  {selectedArticle.category}
                </span>
                <span className="text-gray-500 text-lg">{selectedArticle.date}</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-8 leading-tight text-gray-900">
                {selectedArticle.title}
              </h1>
              <div className="flex items-center gap-4 mb-12 text-gray-600">
                <span className="font-semibold">{selectedArticle.author}</span>
                <span>•</span>
                <span>{selectedArticle.readTime}</span>
              </div>
            </header>
            
            <div className="prose prose-lg md:prose-xl lg:prose-2xl max-w-none bg-white/80 backdrop-blur-sm p-12 rounded-3xl shadow-2xl">
              <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl">
                <h3 className="text-2xl font-bold text-blue-900 mb-4">📋 الملخص التنفيذي</h3>
                <p className="text-xl leading-relaxed">{selectedArticle.excerpt}</p>
              </div>
              <div 
                className="leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: selectedArticle.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>') 
                }} 
              />
            </div>
          </article>
        )}
      </div>

      <footer className="mt-24 bg-[#ce1126] text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold mb-4">مركز الدراسات الجزائرية السياسية والاقتصادية</h3>
          <p>تحليلات يومية مدعومة بالبيانات • تقارير موضوعية • رؤى استراتيجية</p>
        </div>
      </footer>
    </div>
  );
}
