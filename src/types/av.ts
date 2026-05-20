export interface Movie {
  code: string;
  title: string;
  url: string;
  imageUrl: string;
  source: string;
  category: string;
  maker: string;
  themes: string[];
  actress?: string | null;
}