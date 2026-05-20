'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, motion } from 'framer-motion';
import { Info } from 'lucide-react';
import type { Movie } from '@/types/av';
import { AvCard } from './AvCard';

interface MovieGridProps {
  movies: Movie[];
  favorites: string[];
  onToggleFavorite: (code: string) => void;
  onSelectMovie: (movie: Movie) => void;
}

const COLUMN_BREAKPOINTS: Array<[number, number]> = [
  [1920, 10],
  [1536, 8],
  [1280, 6],
  [1024, 5],
  [768, 4],
  [640, 3],
  [0, 2],
];

function getColumnCount(width: number): number {
  return COLUMN_BREAKPOINTS.find(([min]) => width >= min)?.[1] ?? 2;
}

export function MovieGrid({
  movies,
  favorites,
  onToggleFavorite,
  onSelectMovie,
}: MovieGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(6);

  useEffect(() => {
    const update = () => setColumns(getColumnCount(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const rows = useMemo(() => {
    const out: Movie[][] = [];
    for (let i = 0; i < movies.length; i += columns) {
      out.push(movies.slice(i, i + columns));
    }
    return out;
  }, [movies, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280,
    overscan: 4,
  });

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
    <div ref={parentRef} className="h-[calc(100vh-220px)] overflow-auto">
      <AnimatePresence mode="popLayout">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="grid gap-3 pb-3"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {rows[virtualRow.index].map((movie) => (
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
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
