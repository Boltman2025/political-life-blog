import React from 'react';

export const NewsTicker: React.FC = () => {
  return (
    <div className="bg-[#ce1126] text-white py-2 overflow-hidden flex items-center relative z-40">
      <div className="bg-[#a30d1e] px-4 py-1 font-bold z-10 absolute right-0 h-full flex items-center shadow-lg">
        عاجل
      </div>
      <div className="whitespace-nowrap animate-marquee flex gap-10 pr-24">
        <span>رئيس الجمهورية يستقبل وفداً دبلوماسياً رفيع المستوى...</span>
        <span className="text-white/50">|</span>
        <span>وزارة التجارة تعلن عن إجراءات جديدة لضبط الأسعار...</span>
        <span className="text-white/50">|</span>
        <span>المنتخب الوطني يواصل تحضيراته للمنافسات القادمة...</span>
        <span className="text-white/50">|</span>
        <span>افتتاح الصالون الدولي للكتاب بالجزائر العاصمة...</span>
      </div>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
};