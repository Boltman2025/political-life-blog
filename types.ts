export interface Article {
  // ✅ id قد لا يأتي دائمًا من RSS
  id?: string;

  title: string;

  // ✅ قد تكون فارغة
  excerpt?: string;
  content?: string;

  category?: string;
  author?: string;

  // ✅ تاريخ قد يكون فارغًا أو ISO
  date?: string;

  imageUrl?: string;

  // ✅ مهم: الرابط الأصلي موجود في articles.json
  sourceUrl: string;

  isBreaking?: boolean;

  // ✅ موجود في ingest.mjs
  editorialStyle?: string;
}

export enum ViewState {
  HOME = "HOME",
  ARTICLE = "ARTICLE",
}

export const CATEGORIES = ["وطني", "دولي", "اقتصاد", "مجتمع", "رياضة", "رأي"];
