export interface Movie {
  code: string;
  title: string;
  url: string;
  imageUrl: string;
  source: string;
  category: string;
  releaseDate?: string | null; // ISO YYYY-MM-DD
  maker: string;
  themes: string[];
  actress?: string | null;
}