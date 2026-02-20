import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white mt-20 pt-16 pb-8 border-t-4 border-[#ce1126]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          
          <div className="col-span-1 md:col-span-1">
            <h2 className="text-2xl font-extrabold mb-4">
              الحياة <span className="text-[#ce1126]">السياسية</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              منصة إعلامية جزائرية مستقلة، تعنى بالشأن السياسي الوطني والدولي، وتقدم تحليلات معمقة للأحداث الراهنة.
            </p>
            <div className="text-xs text-gray-500">
              © {new Date().getFullYear()} جميع الحقوق محفوظة.
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-4 text-white">الأقسام</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">وطني</a></li>
              <li><a href="#" className="hover:text-white transition-colors">دولي</a></li>
              <li><a href="#" className="hover:text-white transition-colors">اقتصاد</a></li>
              <li><a href="#" className="hover:text-white transition-colors">مجتمع</a></li>
            </ul>
          </div>

          <div>
             <h3 className="font-bold text-lg mb-4 text-white">معلومات</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">من نحن</a></li>
              <li><a href="#" className="hover:text-white transition-colors">اتصل بنا</a></li>
              <li><a href="#" className="hover:text-white transition-colors">سياسة الخصوصية</a></li>
              <li><a href="#" className="hover:text-white transition-colors">شروط الاستخدام</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-4 text-white">تنويه</h3>
            <p className="text-gray-500 text-xs leading-relaxed">
              جميع المقالات والآراء المنشورة تعبر عن رأي أصحابها ولا تعبر بالضرورة عن رأي الموقع.
              <br/><br/>
              مستوحى من تصميم elayem.news
            </p>
          </div>

        </div>
        <div className="text-center text-gray-600 text-xs border-t border-gray-800 pt-8">
          تطوير بواسطة React & Gemini API
        </div>
      </div>
    </footer>
  );
};