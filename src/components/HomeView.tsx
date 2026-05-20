'use client';

import { useMemo, useRef, useState } from 'react';
import type { Movie } from '@/types/av';
import { Header } from './Header';
import { MovieGrid } from './MovieGrid';
import { MovieDetailModal } from './MovieDetailModal';
import { ImportExportDialog } from './ImportExportDialog';
import { useFavorites } from '@/hooks/useFavorites';
import { useAddMovie, useMovies } from '@/hooks/useMovies';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface HomeViewProps {
  initialMovies: Movie[];
}

export function HomeView({ initialMovies }: HomeViewProps) {
  const { data: movies = initialMovies } = useMovies();
  const addMovie = useAddMovie();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSource, setActiveSource] = useState('全部');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [activeMaker, setActiveMaker] = useState('全部');
  const [activeTheme, setActiveTheme] = useState('全部');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [importExportOpen, setImportExportOpen] = useState(false);
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
  ]);

  const sources = useMemo(
    () => ['全部', ...Array.from(new Set(movies.map((m) => m.source)))],
    [movies]
  );
  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(movies.map((m) => m.category)))],
    [movies]
  );
  const makers = useMemo(
    () => ['全部', ...Array.from(new Set(movies.map((m) => m.maker))).sort()],
    [movies]
  );
  const themes = useMemo(() => {
    const set = new Set<string>();
    movies.forEach((m) => m.themes.forEach((t) => set.add(t)));
    return ['全部', ...Array.from(set).sort()];
  }, [movies]);

  const filtered = useMemo(() => {
    return movies.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        m.title.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.actress ?? '').toLowerCase().includes(q);
      const matchesSource = activeSource === '全部' || m.source === activeSource;
      const matchesCategory = activeCategory === '全部' || m.category === activeCategory;
      const matchesMaker = activeMaker === '全部' || m.maker === activeMaker;
      const matchesTheme = activeTheme === '全部' || m.themes.includes(activeTheme);
      const matchesFav = !showFavoritesOnly || isFavorite(m.code);
      return (
        matchesSearch && matchesSource && matchesCategory &&
        matchesMaker && matchesTheme && matchesFav
      );
    });
  }, [
    movies, searchQuery, activeSource, activeCategory,
    activeMaker, activeTheme, showFavoritesOnly, isFavorite,
  ]);

  const handleAddMovie = async () => {
    const url = window.prompt('請輸入影片網址 (Jable, MissAV, Javrate)：');
    if (!url) return;
    try {
      await addMovie.mutateAsync(url);
    } catch (e) {
      window.alert('新增失敗：' + (e as Error).message);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white font-inter selection:bg-indigo-500/30">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sources={sources}
        categories={categories}
        makers={makers}
        themes={themes}
        activeSource={activeSource}
        activeCategory={activeCategory}
        activeMaker={activeMaker}
        activeTheme={activeTheme}
        onSourceChange={setActiveSource}
        onCategoryChange={setActiveCategory}
        onMakerChange={setActiveMaker}
        onThemeChange={setActiveTheme}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesOnly={() => setShowFavoritesOnly((v) => !v)}
        onAddMovie={handleAddMovie}
        isAdding={addMovie.isPending}
        totalCount={filtered.length}
        onOpenImportExport={() => setImportExportOpen(true)}
        searchInputRef={searchInputRef}
      />
      <div className="mx-auto max-w-[1920px] px-4 py-8 sm:px-6 lg:px-8">
        <MovieGrid
          movies={filtered}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onSelectMovie={setSelectedMovie}
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
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-1/4 h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>
    </main>
  );
}
