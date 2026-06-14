'use client';

import { useMemo, useRef, useState } from 'react';
import type { Movie } from '@/types/av';
import { Header } from './Header';
import { MovieGrid } from './MovieGrid';
import { MovieDetailModal } from './MovieDetailModal';
import { ImportExportDialog } from './ImportExportDialog';
import { AddMovieDialog } from './AddMovieDialog';
import { useFavorites } from '@/hooks/useFavorites';
import { usePreferredActresses } from '@/hooks/usePreferredActresses';
import { useAddMovie, useMovies } from '@/hooks/useMovies';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface HomeViewProps {
  initialMovies: Movie[];
}

export function HomeView({ initialMovies }: HomeViewProps) {
  const { data: movies = initialMovies } = useMovies();
  const addMovie = useAddMovie();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const preferredActresses = usePreferredActresses();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);
  const [showFavActressOnly, setShowFavActressOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'added' | 'release' | 'match'>('added');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      meta: true,
      handler: () => searchInputRef.current?.focus(),
    },
    {
      key: 'f',
      handler: () => setShowFavoritesOnly((v) => !v),
    },
    {
      key: 'r',
      handler: () => setShowRecommendedOnly((v) => !v),
    },
    {
      key: 'a',
      handler: () => setShowFavActressOnly((v) => !v),
    },
  ]);

  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(movies.map((m) => m.category)))],
    [movies]
  );

  const favActressSet = useMemo(
    () => new Set(preferredActresses.map((a) => a.trim()).filter(Boolean)),
    [preferredActresses]
  );

  const filtered = useMemo(() => {
    const result = movies.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        m.title.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.actress ?? '').toLowerCase().includes(q);
      const matchesCategory = activeCategory === '全部' || m.category === activeCategory;
      const matchesFav = !showFavoritesOnly || isFavorite(m.code);
      const matchesRecommended = !showRecommendedOnly || m.matchTier === 'high';
      const matchesFavActress =
        !showFavActressOnly || (!!m.actress && favActressSet.has(m.actress));
      return (
        matchesSearch && matchesCategory && matchesFav &&
        matchesRecommended && matchesFavActress
      );
    });

    if (sortBy === 'release') {
      // 有 releaseDate 的排前面（DESC），無的排最後
      return [...result].sort((a, b) => {
        if (!a.releaseDate && !b.releaseDate) return 0;
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return b.releaseDate.localeCompare(a.releaseDate);
      });
    }
    if (sortBy === 'match') {
      // 依口味契合度 DESC，未評分的排最後
      return [...result].sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
    }
    return result; // 'added' = DB 預設順序 (created_at DESC)
  }, [
    movies, searchQuery, activeCategory, showFavoritesOnly,
    showRecommendedOnly, showFavActressOnly, favActressSet, isFavorite, sortBy,
  ]);

  // 篩選/搜尋/排序條件的指紋；變動時 MovieGrid 自動回到第一頁。
  // 刻意不含 favorites，避免單顆收藏 toggle 把分頁彈回第一頁。
  const pageResetKey = useMemo(
    () =>
      JSON.stringify([
        searchQuery,
        activeCategory,
        showFavoritesOnly,
        showRecommendedOnly,
        showFavActressOnly,
        sortBy,
      ]),
    [searchQuery, activeCategory, showFavoritesOnly, showRecommendedOnly, showFavActressOnly, sortBy]
  );

  const handleSubmitAdd = async (url: string) => {
    await addMovie.mutateAsync(url);
  };

  return (
    <main className="min-h-screen bg-background text-white font-inter selection:bg-indigo-500/30">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesOnly={() => setShowFavoritesOnly((v) => !v)}
        showRecommendedOnly={showRecommendedOnly}
        onToggleRecommendedOnly={() => setShowRecommendedOnly((v) => !v)}
        showFavActressOnly={showFavActressOnly}
        onToggleFavActressOnly={() => setShowFavActressOnly((v) => !v)}
        onAddMovie={() => setAddOpen(true)}
        isAdding={addMovie.isPending}
        totalCount={filtered.length}
        onOpenImportExport={() => setImportExportOpen(true)}
        searchInputRef={searchInputRef}
        sortBy={sortBy}
        onToggleSort={() =>
          setSortBy((v) => (v === 'added' ? 'release' : v === 'release' ? 'match' : 'added'))
        }
        onChangeSort={setSortBy}
      />
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        <MovieGrid
          movies={filtered}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onSelectMovie={setSelectedMovie}
          resetKey={pageResetKey}
        />
      </div>
      <MovieDetailModal
        movie={selectedMovie}
        onClose={() => setSelectedMovie(null)}
      />
      <ImportExportDialog
        open={importExportOpen}
        onClose={() => setImportExportOpen(false)}
      />
      <AddMovieDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleSubmitAdd}
        isSubmitting={addMovie.isPending}
      />
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-1/4 h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>
    </main>
  );
}
