import { Article } from "./types";

type Props = {
  article: Article;
  featured?: boolean;
  onClick?: () => void;
};

type SectionKey = "وطني" | "اقتصاد" | "دولي" | "رأي";

function detectSection(a: any): SectionKey {
  const sec = String(a?.section || "").trim();
  if (sec === "وطني" || sec === "اقتصاد" || sec === "دولي" || sec === "رأي") return sec as SectionKey;

  const cat = String(a?.category || "").trim();
  if (cat === "وطني" || cat === "اقتصاد" || cat === "دولي" || cat === "رأي") return cat as SectionKey;

  const tags = Array.isArray(a?.aiTags) ? a.aiTags.join(" ") : "";
  const text = `${a?.aiTitle || a?.title || ""} ${a?.aiSummary || ""} ${tags}`.toLowerCase();

  // اقتصاد
  if (
    text.includes("اقتصاد") ||
    text.includes("مالية") ||
    text.includes("استثمار") ||
    text.includes("تضخم") ||
    text.includes("بنك") ||
    text.includes("نفط") ||
    text.includes("غاز") ||
    text.includes("طاقة") ||
    text.includes("تصدير") ||
    text.includes("استيراد") ||
    text.includes("ميزانية") ||
    text.includes("أسعار")
  ) {
    return "اقتصاد";
  }

  // رأي
  if (text.includes("رأي") || text.includes("تحليل") || text.includes("وجهة نظر") || text.includes("افتتاحية")) {
    return "رأي";
  }

  // دولي
  if (
    text.includes("دولي") ||
    text.includes("الأمم المتحدة") ||
    text.includes("مجلس الأمن") ||
    text.includes("الاتحاد الأوروبي") ||
    text.includes("واشنطن") ||
    text.includes("موسكو") ||
    text.includes("باريس") ||
    text.includes("بروكسل") ||
    text.includes("الشرق الأوسط") ||
    text.includes("غزة") ||
    text.includes("فلسطين") ||
    text.includes("سوريا") ||
    text.includes("ليبيا") ||
    text.includes("مالي") ||
    text.includes("النيجر") ||
    text.includes("تونس") ||
    text.includes("المغرب")
  ) {
    return "دولي";
  }

  // وطني افتراضي
  return "وطني";
}

function pickDefaultImage(section: SectionKey) {
  switch (section) {
    case "وطني":
      return "/images/default-national.png";
    case "اقتصاد":
      return "/images/default-economy.png";
    case "دولي":
      return "/images/default-world.png";
    case "رأي":
      return "/images/default-opinion.png";
    default:
      return "/images/default-national.png";
  }
}

function isValidImageUrl(url?: string) {
  const u = (url || "").trim();
  if (!u) return false;
  // نتجنب بعض القيم “المزعجة” الشائعة
  if (u === "#" || u.toLowerCase() === "null" || u.toLowerCase() === "undefined") return false;
  return true;
}

export function ArticleCard({ article, featured, onClick }: Props) {
  const title = article.aiTitle || article.title;
  const excerpt = article.aiSummary || article.excerpt;

  const section = detectSection(article);
  const image = isValidImageUrl(article.imageUrl) ? (article.imageUrl as string) : pickDefaultImage(section);

  return (
    <article
      onClick={onClick}
      className={`cursor-pointer bg-white rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition ${
        featured ? "flex flex-col" : ""
      }`}
    >
      {/* الصورة */}
      <div className={featured ? "h-80" : "h-44"}>
        <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
      </div>

      {/* المحتوى */}
      <div className="p-4 flex flex-col gap-2">
        <span className="text-xs text-red-700 font-bold">{section}</span>

        <h2 className={`font-bold leading-snug ${featured ? "text-2xl" : "text-base"}`}>{title}</h2>

        {excerpt && <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">{excerpt}</p>}

        {article.date && <time className="text-xs text-gray-500 mt-1">{article.date}</time>}
      </div>
    </article>
  );
}
