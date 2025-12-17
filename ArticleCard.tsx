import React from "react";
import { Article } from "./types";

type Props = {
  article: Article & {
    aiTitle?: string;
    aiSummary?: string;
    imageUrl?: string;
    section?: string;
  };
  featured?: boolean;
  onClick?: () => void;
};

export function ArticleCard({ article, featured = false, onClick }: Props) {
  const title = (article as any).aiTitle || article.title;
  const summary = (article as any).aiSummary || article.excerpt || "";
  const imageUrl = (article as any).imageUrl as string | undefined;
  const section = (article as any).section as string | undefined;

  return (
    <article
      className={`bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition cursor-pointer`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
    >
      {imageUrl ? (
        <div className={featured ? "w-full" : "w-full"}>
          <img
            src={imageUrl}
            alt={title}
            className={
              featured
                ? "w-full h-[360px] object-cover"
                : "w-full h-48 object-cover"
            }
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      ) : null}

      <div className={featured ? "p-6" : "p-5"}>
        <div className="flex items-center justify-between gap-3 mb-3">
          {section ? (
            <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-100">
              {section}
            </span>
          ) : (
            <span />
          )}

          {article.date ? (
            <time className="text-xs text-gray-500">{article.date}</time>
          ) : null}
        </div>

        <h2
          className={
            featured
              ? "text-2xl font-extrabold leading-snug text-gray-900"
              : "text-lg font-bold leading-snug text-gray-900"
          }
        >
          {title}
        </h2>

        {summary ? (
          <p className="mt-3 text-gray-700 leading-relaxed">
            {featured ? summary : summary.slice(0, 180) + (summary.length > 180 ? "…" : "")}
          </p>
        ) : null}

        {article.sourceUrl ? (
          <div className="mt-4 text-xs text-gray-500 break-all">
            {article.sourceUrl}
          </div>
        ) : null}
      </div>
    </article>
  );
}
