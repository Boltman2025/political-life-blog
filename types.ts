export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  date: string;
  imageUrl: string;
  sourceUrl: string;
  isBreaking?: boolean;

  // ✅ مهم لفلترة Primary/Backfill
  sourceTier?: "primary" | "backfill";
}

export enum ViewState {
  HOME = "HOME",
  ARTICLE = "ARTICLE",
}

export const CATEGORIES = ["وطني", "دولي", "اقتصاد", "مجتمع", "رياضة", "رأي"];
