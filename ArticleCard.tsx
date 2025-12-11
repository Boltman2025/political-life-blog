import React from 'react';
import { Article } from '../types';
import { Clock } from 'lucide-react';

interface ArticleCardProps {
  article: Article;
  onClick: (article: Article) => void;
  featured?: boolean;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick, featured = false }) => {
  if (featured) {
    return (
      <div 
        onClick={() => onClick(article)}
        className="group relative h-[400px] md:h-[500px] w-full overflow-hidden cursor-pointer rounded-lg shadow-md"
      >
        <img 
          src={article.imageUrl} 
          alt={article.title} 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
        <div className="absolute bottom-0 right-0 p-6 md:p-8 text-white w-full md:w-3/4">
          <span className="bg-[#ce1126] text-white text-xs font-bold px-2 py-1 mb-3 inline-block rounded-sm">
            {article.category}
          </span>
          <h2 className="text-2xl md:text-4xl font-bold leading-tight mb-3 group-hover:text-gray-200 transition-colors">
            {article.title}
          </h2>
          <p className="text-gray-300 line-clamp-2 md:line-clamp-3 mb-4 font-serif-ar text-lg">
            {article.excerpt}
          </p>
          <div className="flex items-center text-xs text-gray-400 gap-2">
            <span>{article.author}</span>
            <span>•</span>
            <Clock className="w-3 h-3" />
            <span>{article.date}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={() => onClick(article)}
      className="group bg-white flex flex-col h-full border border-gray-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={article.imageUrl} 
          alt={article.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded-sm">
          {article.category}
        </span>
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-bold text-gray-900 leading-snug mb-2 group-hover:text-[#ce1126] transition-colors">
          {article.title}
        </h3>
        <p className="text-gray-600 text-sm line-clamp-3 mb-4 font-serif-ar flex-grow">
          {article.excerpt}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-gray-100">
           <span>{article.date}</span>
        </div>
      </div>
    </div>
  );
};