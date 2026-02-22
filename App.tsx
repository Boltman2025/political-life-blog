// نفس الكود السابق لكن غيّر URL فقط:
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Boltman2025/political-life-blog/main/data/live.json';

// أضف في أعلى الصفحة شريط أخبار متحرك:
<div className="bg-red-600 text-white py-3 shadow-2xl sticky top-0 z-50">
  <div className="container mx-auto px-6">
    <div className="flex items-center gap-6 overflow-hidden">
      <span className="font-bold text-xl whitespace-nowrap">🚨 شريط الأخبار الفورية:</span>
      <div className="flex gap-8 animate-marquee whitespace-nowrap">
        {articles.slice(0, 6).map(article => (
          <a key={article.id} href={article.url} target="_blank" 
             className="font-bold hover:text-yellow-300 transition-all bg-black/20 px-4 py-2 rounded-full">
            {article.title}
          </a>
        ))}
      </div>
    </div>
  </div>
</div>

// CSS للشريط المتحرك:
const marqueeStyle = `
@keyframes marquee {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
.animate-marquee {
  animation: marquee 30s linear infinite;
}
`;
