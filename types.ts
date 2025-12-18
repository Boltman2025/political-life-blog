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

  // ✅ مهم لفلترة Primary/Backfill/DZ
  sourceTier?: "primary" | "dz" | "backfill";

  // ✅ AI fields (اختيارية)
  aiTitle?: string;
  aiSummary?: string;
  aiBody?: string;
  aiBullets?: string[];
  aiTags?: string[];
  aiUpdatedAt?: string;

  // ✅ إن وُجدت في البيانات
  section?: string;
  publishedAt?: string;
  pubDate?: string;
}

export enum ViewState {
  HOME = "HOME",
  ARTICLE = "ARTICLE",
}

export const CATEGORIES = ["وطني", "دولي", "اقتصاد", "مجتمع", "رياضة", "رأي"];
