import { Article } from "./types";

type Props = {
  article: Article & {
    aiTitle?: string;
    aiSummary?: string;
  };
  featured?: boolean;
  onClick?: () => void;
};

function pickDefaultImage(section?: string) {
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

export function ArticleCard({ article, featured, onClick }: Props) {
  const title = article.aiTitle || article.title;
  const excerpt = article.aiSummary || article.excerpt;
  const image =
    article.imageUrl && article.imageUrl.trim() !== ""
      ? article.imageUrl
      : pickDefaultImage(article.section);

  return (
    <article
      onClick={onClick}
      className={`cursor-pointer bg-white rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition ${
        featured ? "flex flex-col" : ""
      }`}
    >
      {/* الصورة */}
      <div className={featured ? "h-80" : "h-44"}>
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* المحتوى */}
      <div className="p-4 flex flex-col gap-2">
        {article.section && (
          <span className="text-xs text-red-700 font-bold">
            {article.section}
          </span>
        )}

        <h2
          className={`font-bold leading-snug ${
            featured ? "text-2xl" : "text-base"
          }`}
        >
          {title}
        </h2>

        {excerpt && (
          <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
            {excerpt}
          </p>
        )}

        {article.date && (
          <time className="text-xs text-gray-500 mt-1">
            {article.date}
          </time>
        )}
      </div>
    </article>
  );
}
