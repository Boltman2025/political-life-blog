import React, { useState, useEffect } from 'react';

type Article = {
  id: string; title: string; excerpt: string; content: string; 
  category: string; author: string; date: string; imageUrl: string;
  isBreaking: boolean; readTime: string; url: string; keyPoints: string[]; impact: string;
};

const GITHUB_LIVE = 'https://raw.githubusercontent.com/Boltman2025/political-life-blog/main/data/live.json';

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch(`${GITHUB_LIVE}?t=${Date.now()}`);
        const data = await res.json();
        setArticles(Array.isArray(data) ? data : []);
      } catch(e) {
        console.log('Fallback data');
        setArticles([{
          id: 'demo', title: '🚨 النظام يعمل! أخبار جزائرية حية قادمة...', 
          excerpt: 'شريط الأخبار المتحرك جاهز', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&fit=crop',
          content: '<strong>جاهز!</strong>', category: 'عاجل', author: 'النظام', date: new Date().toLocaleString('ar'),
          isBreaking: true, readTime: '1د', url: 'https://aps.dz', keyPoints: [], impact: ''
        }]);
      } finally { setLoading(false); }
    };
    fetchLive(); 
    const int = setInterval(fetchLive, 60000); // دقيقة
    return () => clearInterval(int);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-100 to-orange-100">
    <div className="text-2xl font-bold text-red-600 animate-pulse">🚨 جاري تحميل شريط الأخبار الحي...</div>
  </div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-yellow-50 text-gray-900" dir="rtl">
      
      {/* 🚨 شريط الأخبار المتحرك الأساسي */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-2xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3">
          <div className="relative overflow-hidden">
            <div className="flex gap-8 animate-marquee whitespace-nowrap">
              {articles.map(a => (
                <a key={a.id} href={a.url} target="_blank" 
                   className="bg-black/20 px-6 py-3 rounded-full font-bold text-lg hover:bg-white hover:text-red-600 transition-all whitespace-nowrap min-w-fit">
                  {a.title}
                </a>
              ))}
              {/* نسخة ثانية للدوران المستمر */}
              {articles.map(a => (
                <a key={`dup-${a.id}`} href={a.url} target="_blank" 
                   className="bg-black/20 px-6 py-3 rounded-full font-bold text-lg hover:bg-white hover:text-red-600 transition-all whitespace-nowrap min-w-fit">
                  {a.title}
                </a>
              ))}
            </div>
          </div>
          <div className="text-center mt-2 text-sm opacity-90">آخر تحديث: {new Date().toLocaleString('ar-DZ')}</div>
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
      `}</style>

      {/* بطاقات الأخبار */}
      <div className="container mx-auto px-6 py-12 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map(article => (
            <div key={article.id} className="bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer">
              
              {/* صورة مضمونة 100% */}
              <div className="h-56 bg-gradient-to-r from-gray-200 to-gray-300 relative overflow-hidden">
                <img 
                  src={article.imageUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&fit=crop'} 
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&fit=crop';
                  }}
                />
                {article.isBreaking && (
                  <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                    🚨 عاجل
                  </div>
                )}
              </div>

              <div className="p-6">
                <span className="inline-block bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold mb-3">
                  {article.category}
                </span>
                <h3 className="font-bold text-xl mb-3 line-clamp-2 leading-tight text-gray-900 hover:text-red-600">
                  {article.title}
                </h3>
                <p className="text-gray-600 mb-4 line-clamp-2">{article.excerpt}</p>
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{article.date}</span>
                  <a href={article.url} target="_blank" className="text-blue-600 font-bold hover:underline">
                    المصدر →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* زر تحديث */}
        <div className="text-center mt-16">
          <button onClick={() => window.location.reload()} 
                  className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-12 py-4 rounded-3xl font-bold text-xl hover:shadow-2xl transition-all">
            🔄 تحديث شريط الأخبار الحي
          </button>
        </div>
      </div>

      <footer className="bg-gradient-to-r from-red-700 to-orange-600 text-white py-8 mt-24">
        <div className="container mx-auto px-6 text-center">
          <p className="text-xl font-bold">🚨 شريط الأخبار الجزائري الحي - وكالة الأنباء + Google News</p>
        </div>
      </footer>
    </div>
  );
}
