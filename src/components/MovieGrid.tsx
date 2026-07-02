'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info } from 'lucide-react';
import type { Movie } from '@/types/av';
import { AvCard } from './AvCard';
import { Pagination } from './Pagination';

interface MovieGridProps {
  movies: Movie[];
  favorites: string[];
  onToggleFavorite: (code: string) => void;
  onSelectMovie: (movie: Movie) => void;
  /** 一頁顯示幾部，預設 24。 */
  pageSize?: number;
  /** 此值變動時自動跳回第一頁（用來在篩選/搜尋改變時 reset）。 */
  resetKey?: string;
  onDeleteUpcoming?: (code: string) => void;
}

export function MovieGrid({
  movies,
  favorites,
  onToggleFavorite,
  onSelectMovie,
  pageSize = 24,
  resetKey,
  onDeleteUpcoming,
}: MovieGridProps) {
  const [page, setPage] = useState(1);

  // 篩選/搜尋條件改變 → 回到第一頁（收藏單顆 toggle 不會觸發，因為 resetKey 不含它）
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(movies.length / pageSize));
  const safePage = Math.min(page, totalPages);

  // 列表變短導致目前頁超出範圍時，把 state 收斂回合法頁
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => movies.slice((safePage - 1) * pageSize, safePage * pageSize),
    [movies, safePage, pageSize]
  );

  const goTo = (p: number) => {
    setPage(p);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (movies.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-32 text-center"
      >
        <div className="mb-4 rounded-full bg-white/5 p-4">
          <Info className="h-8 w-8 text-white/20" />
        </div>
        <h3 className="text-lg font-medium text-white/60">找不到相符的結果</h3>
        <p className="text-sm text-white/30">請嘗試更改搜尋關鍵字或篩選條件</p>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {pageItems.map((movie) => (
            <motion.div
              key={movie.code}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <AvCard
                movie={movie}
                favorited={favorites.includes(movie.code)}
                onToggleFavorite={onToggleFavorite}
                onSelect={onSelectMovie}
                onDeleteUpcoming={onDeleteUpcoming}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={goTo} />
    </div>
  );
}
