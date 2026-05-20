import { Movie } from "@/types/av";
import moviesData from "./data.json";
import { extractMaker, extractThemes, extractActress } from "./metadata";

export const movies: Movie[] = (moviesData as any[]).map(item => ({
  ...item,
  maker: extractMaker(item.code),
  themes: extractThemes(item.title),
  actress: extractActress(item.title)
}));
