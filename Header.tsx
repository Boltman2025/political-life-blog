import React, { useState } from "react";
import { Menu, Search, X } from "lucide-react";

type SectionKey = "الكل" | "وطني" | "دولي" | "اقتصاد" | "مجتمع" | "رياضة" | "رأي";

interface HeaderProps {
  onHomeClick?: () => void;
  onSectionSelect?: (section: SectionKey) => void;
  activeSection?: SectionKey;
}

const CATEGORIES: SectionKey[] = ["وطني", "دولي", "اقتصاد", "مجتمع", "رياضة", "رأي"];

export const Header: React.FC<HeaderProps> = ({
  onHomeClick = () => {},
  onSectionSelect,
  activeSection = "الكل",
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSelect = (cat: SectionKey) => {
    // ✅ يرجع للرئيسية عبر onHomeClick ثم يطبّق الفلتر
    onHomeClick();
    if (onSectionSelect) onSectionSelect(cat);
    setIsMenuOpen(false);
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50 border-b-4 border-[#ce1126]">
      <div className="bg-gray-900 text-white text-xs py-1 px-4 hidden md:block">
        <div className="container mx-auto flex justify-between items-center">
          <span>
            {new Date().toLocaleDateString("ar-DZ", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-gray-300">فيسبوك</span>
            <span className="cursor-pointer hover:text-gray-300">تويتر</span>
            <span className="cursor-pointer hover:text-gray-300">يوتيوب</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex flex-col cursor-pointer" onClick={onHomeClick}>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tighter">
              الحياة <span className="text-[#ce1126]">السياسية</span>
            </h1>
            <span className="text-xs text-gray-500 tracking-widest mt-1">DESK ONLINE</span>
          </div>

          <nav className="hidden md:flex gap-6 items-center font-bold text-gray-700">
            <button
              onClick={() => handleSelect("الكل")}
              className={`transition-colors hover:text-[#ce1126] ${
                activeSection === "الكل" ? "text-[#ce1126]" : ""
              }`}
            >
              الرئيسية
            </button>

            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelect(cat)}
                className={`transition-colors hover:text-[#ce1126] ${
                  activeSection === cat ? "text-[#ce1126]" : ""
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-full" aria-label="Search">
              <Search className="w-5 h-5 text-gray-600" />
            </button>
            <button
              className="md:hidden p-2 hover:bg-gray-100 rounded-full"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 py-4 px-4 shadow-lg absolute w-full left-0">
          <nav className="flex flex-col gap-3 font-semibold text-gray-800">
            <button
              onClick={() => handleSelect("الكل")}
              className={`text-right hover:text-[#ce1126] ${
                activeSection === "الكل" ? "text-[#ce1126]" : ""
              }`}
            >
              الرئيسية
            </button>

            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelect(cat)}
                className={`text-right hover:text-[#ce1126] ${
                  activeSection === cat ? "text-[#ce1126]" : ""
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};
