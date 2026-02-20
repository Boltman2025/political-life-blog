export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  date: string;
  imageUrl: string;
  isBreaking?: boolean;
}

export enum ViewState {
  HOME = 'HOME',
  ARTICLE = 'ARTICLE'
}

export const CATEGORIES = [
  "وطني",
  "دولي",
  "اقتصاد",
  "مجتمع",
  "رياضة",
  "رأي"
];