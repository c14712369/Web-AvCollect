'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, User } from 'lucide-react';
import type { Movie } from '@/types/av';
import { MovieGrid } from './MovieGrid';
import { MovieDetailModal } from './MovieDetailModal';
import { useFavorites } from '@/hooks/useFavorites';

interface ActressViewProps {
  name: string;
  works: Movie[];
}

export function ActressView({ name, works }: ActressViewProps) {
  const { favorites, toggleFavorite } = useFavorites();
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  const sourceBreakdown = works.reduce<Record<string, number>>((acc, m) => {
    acc[m.source] = (acc[m.source] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-background text-white font-inter selection:bg-indigo-500/30">
      <header className="sticky top-0 z-50 w-full border-b border-white/5 glass">
        <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="回首頁"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-violet-700 shadow-lg shadow-rose-500/30">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest">追蹤女優</p>
                <h1 className="text-xl font-bold tracking-tight text-white leading-tight">{name}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full glass border border-white/5 px-5 py-2.5">
                <span className="text-xs font-medium text-white/30 uppercase tracking-tighter">作品數</span>
                <span className="text-sm font-bold text-rose-300 font-mono">
                  {works.length.toString().padStart(2, '0')}
                </span>
              </div>
              {Object.entries(sourceBreakdown).map(([src, count]) => (
                <div
                  key={src}
                  className="hidden sm:flex items-center gap-2 rounded-full glass border border-white/5 px-4 py-2"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{src}</span>
                  <span className="text-xs font-bold text-white/80 font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        <MovieGrid
          movies={works}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onSelectMovie={setSelectedMovie}
        />
      </div>

      <MovieDetailModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 h-[500px] w-[500px] rounded-full bg-rose-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-1/4 h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>
    </main>
  );
}
