import React, { useState } from 'react';
import { Article } from '../types';
import { summarizeArticle } from '../services/geminiService';
import { Share2, Bookmark, Sparkles, AlertCircle } from 'lucide-react';

interface ArticleViewProps {
  article: Article;
  relatedArticles: Article[];
  onArticleClick: (article: Article) => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({ article, relatedArticles, onArticleClick }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSummarize = async () => {
    setLoading(true);
    const result = await summarizeArticle(article.content);
    setSummary(result);
    setLoading(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="w-full lg:w-2/3">
        <article className="bg-white p-6 md:p-8 rounded-lg shadow-sm border border-gray-100">
          
          <div className="flex items-center gap-2 mb-4">
             <span className="bg-[#ce1126] text-white text-xs font-bold px-2 py-1 rounded-sm">
              {article.category}
            </span>
             <span className="text-gray-500 text-sm">{article.date}</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
            {article.title}
          </h1>

          <div className="flex items-center justify-between border-y border-gray-100 py-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">
                {article.author.charAt(0)}
              </div>
              <div className="text-sm">
                <p className="font-bold text-gray-900">{article.author}</p>
                <p className="text-gray-500">صحفي سياسي</p>
              </div>
            </div>
            <div className="flex gap-3 text-gray-500">
              <button className="hover:text-[#ce1126]"><Share2 className="w-5 h-5"/></button>
              <button className="hover:text-[#ce1126]"><Bookmark className="w-5 h-5"/></button>
            </div>
          </div>

          <img 
            src={article.imageUrl} 
            alt={article.title} 
            className="w-full h-auto rounded-lg mb-8 shadow-sm"
          />

          {/* AI Summary Section */}
          <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#ce1126]" />
                ملخص الذكاء الاصطناعي
              </h3>
              {!summary && (
                <button 
                  onClick={handleSummarize} 
                  disabled={loading}
                  className="text-xs bg-gray-900 text-white px-3 py-1 rounded-full hover:bg-gray-800 disabled:opacity-50"
                >
                  {loading ? 'جاري التلخيص...' : 'توليد ملخص'}
                </button>
              )}
            </div>
            
            {loading && (
              <div className="animate-pulse space-y-2">
                <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                <div className="h-2 bg-gray-200 rounded w-full"></div>
                <div className="h-2 bg-gray-200 rounded w-5/6"></div>
              </div>
            )}

            {summary && (
              <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line bg-white p-4 rounded border border-gray-100 shadow-sm">
                {summary}
              </div>
            )}
            
             {!summary && !loading && (
               <p className="text-gray-500 text-xs">اضغط على الزر أعلاه للحصول على قراءة سريعة للمقال باستخدام Gemini AI.</p>
             )}
          </div>

          <div className="prose prose-lg prose-headings:font-bold prose-p:font-serif-ar prose-p:text-lg text-gray-800 max-w-none">
            <p className="lead font-bold text-xl mb-4 text-gray-900">{article.excerpt}</p>
            <div className="whitespace-pre-wrap">{article.content}</div>
          </div>

          <div className="mt-10 pt-6 border-t border-gray-200">
            <h4 className="font-bold mb-4">الكلمات المفتاحية:</h4>
            <div className="flex flex-wrap gap-2">
              {['الجزائر', 'سياسة', 'حكومة', 'انتخابات', 'اقتصاد'].map(tag => (
                <span key={tag} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm hover:bg-gray-200 cursor-pointer">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </article>
      </div>

      <div className="w-full lg:w-1/3">
        <h3 className="font-bold text-xl mb-4 border-r-4 border-[#ce1126] pr-3">مقالات ذات صلة</h3>
        <div className="flex flex-col gap-4">
          {relatedArticles.slice(0,3).map(related => (
            <div 
              key={related.id} 
              onClick={() => onArticleClick(related)}
              className="group cursor-pointer bg-white p-3 rounded shadow-sm border border-gray-100 flex gap-3"
            >
              <img src={related.imageUrl} className="w-20 h-20 object-cover rounded-sm" alt="" />
              <div>
                <h4 className="text-sm font-bold leading-snug group-hover:text-[#ce1126] transition-colors mb-1">
                  {related.title}
                </h4>
                <span className="text-xs text-gray-400">{related.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};