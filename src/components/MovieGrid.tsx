'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Movie } from '@/types/av';
import { pageFromSearchParam } from '@/lib/client-state';
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
  /** 由外層以 transition 包裹分頁導覽，讓載入遮罩能先繪製。 */
  onPageChange?: (navigate: () => void) => void;
}

export function MovieGrid({
  movies,
  favorites,
  onToggleFavorite,
  onSelectMovie,
  pageSize = 24,
  resetKey,
  onDeleteUpcoming,
  onPageChange,
}: MovieGridProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = pageFromSearchParam(searchParams.get('page'));
  const previousResetKey = useRef(resetKey);

  const setUrlPage = useCallback((nextPage: number, mode: 'push' | 'replace') => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    const query = params.toString();
    router[mode](`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  }, [pathname, router, searchParams]);

  // 篩選/搜尋條件改變 → 回到第一頁（收藏單顆 toggle 不會觸發，因為 resetKey 不含它）
  useEffect(() => {
    if (previousResetKey.current === resetKey) return;
    previousResetKey.current = resetKey;
    if (page > 1) setUrlPage(1, 'replace');
  }, [resetKey, page, setUrlPage]);

  const totalPages = Math.max(1, Math.ceil(movies.length / pageSize));
  const safePage = Math.min(page, totalPages);

  // 列表變短導致目前頁超出範圍時，把網址收斂回合法頁。
  useEffect(() => {
    if (page > totalPages) setUrlPage(totalPages, 'replace');
  }, [page, totalPages, setUrlPage]);

  const pageItems = useMemo(
    () => movies.slice((safePage - 1) * pageSize, safePage * pageSize),
    [movies, safePage, pageSize]
  );

  const goTo = (p: number) => {
    const navigate = () => {
      setUrlPage(Math.min(Math.max(p, 1), totalPages), 'push');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    if (onPageChange) onPageChange(navigate);
    else navigate();
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
        {pageItems.map((movie) => (
          <div key={movie.code}>
            <AvCard
              movie={movie}
              favorited={favorites.includes(movie.code)}
              onToggleFavorite={onToggleFavorite}
              onSelect={onSelectMovie}
              onDeleteUpcoming={onDeleteUpcoming}
            />
          </div>
        ))}
      </div>

      <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={goTo} />
    </div>
  );
}
