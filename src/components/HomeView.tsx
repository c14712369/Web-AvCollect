'use client';

import { useMemo, useRef, useState } from 'react';
import type { Movie } from '@/types/av';
import { Header, type SortOption } from './Header';
import { MovieGrid } from './MovieGrid';
import { MovieDetailModal } from './MovieDetailModal';
import { AddMovieDialog } from './AddMovieDialog';
import { useFavorites } from '@/hooks/useFavorites';
import { usePreferredActresses } from '@/hooks/usePreferredActresses';
import { useAddMovie, useMovies } from '@/hooks/useMovies';
import { useUpcomingMovies, useDeleteUpcomingMovie } from '@/hooks/useUpcomingMovies';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ACTRESS_SPLIT_REGEX, matchActress } from '@/lib/actress-matcher';

interface HomeViewProps {
  initialMovies: Movie[];
}

export function HomeView({ initialMovies }: HomeViewProps) {
  const { data: movies = initialMovies } = useMovies();
  const addMovie = useAddMovie();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const preferredActresses = usePreferredActresses();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFavActress, setActiveFavActress] = useState('全部');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showFavActressOnly, setShowFavActressOnly] = useState(false);
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('added');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
 
  // 預售新片 (改與 showUpcomingOnly 連動)
  const { data: upcomingMovies = [], isLoading: upcomingLoading } = useUpcomingMovies({
    enabled: showUpcomingOnly,
  });
  const deleteUpcoming = useDeleteUpcomingMovie();
 
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
      key: 'a',
      handler: () => {
        setShowFavActressOnly((prev) => {
          if (prev) setActiveFavActress('全部');
          return !prev;
        });
      },
    },
    {
      key: 'u',
      handler: () => setShowUpcomingOnly((v) => !v),
    },
  ]);

  const favoriteMovies = useMemo(() => {
    return movies.filter((m) => isFavorite(m.code));
  }, [movies, isFavorite]);

  const favActressSet = useMemo(
    () => new Set(preferredActresses.map((a) => a.trim().toLowerCase()).filter(Boolean)),
    [preferredActresses]
  );

  // 僅在「喜愛女優」模式下統計名單內女優的作品數
  const favActressCounts = useMemo(() => {
    if (!showFavActressOnly) return {};
    const counts: Record<string, number> = {};
    for (const act of preferredActresses) {
      const trimmed = act.trim();
      if (!trimmed) continue;
      const count = movies.filter((m) =>
        (!!m.actress && matchActress(trimmed, m.actress)) || matchActress(trimmed, m.title)
      ).length;
      if (count > 0) {
        counts[trimmed] = count;
      }
    }
    return counts;
  }, [showFavActressOnly, preferredActresses, movies]);

  // 喜愛女優篩選下拉選單選項（按 A-Z / 筆劃排序）
  const availableFavActressesOrdered = useMemo(() => {
    const names = Object.keys(favActressCounts);
    names.sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    return ['全部', ...names];
  }, [favActressCounts]);
 
  const filtered = useMemo(() => {
    // 預售新片走獨立來源，直接轉換為 Movie 格式
    if (showUpcomingOnly) {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      const result = upcomingMovies
        .filter((m) => {
          // 預售新片若已小於今日日期則剔除
          if (m.releaseDate && m.releaseDate < today) return false;
          const q = searchQuery.toLowerCase();
          const matchesSearch =
            m.title.toLowerCase().includes(q) ||
            m.code.toLowerCase().includes(q) ||
            (m.actress ?? '').toLowerCase().includes(q);
          return matchesSearch;
        })
        .map((m) => ({
          code: m.code,
          title: m.title,
          url: m.url,
          imageUrl: m.imageUrl,
          source: m.source,
          category: '預售新片',
          releaseDate: m.releaseDate ?? null,
          maker: '',
          themes: [],
          actress: m.actress,
        })) as Movie[];

      // 預售新片依發行日期升冪排列 (ASC)，無日期的排在最後
      return [...result].sort((a, b) => {
        if (!a.releaseDate && !b.releaseDate) return 0;
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return a.releaseDate.localeCompare(b.releaseDate);
      });
    }
 
    const result = movies.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        m.title.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.actress ?? '').toLowerCase().includes(q);
      const matchesFav = !showFavoritesOnly || isFavorite(m.code);

      // 只有喜愛女優模式才進行女優篩選
      let matchesFavActress = true;
      if (showFavActressOnly) {
        if (activeFavActress !== '全部') {
          matchesFavActress =
            (!!m.actress && matchActress(activeFavActress, m.actress)) ||
            matchActress(activeFavActress, m.title);
        } else {
          matchesFavActress =
            (!!m.actress &&
              m.actress
                .split(ACTRESS_SPLIT_REGEX)
                .map((a) => a.toLowerCase().trim())
                .filter(Boolean)
                .some((a) => favActressSet.has(a))) ||
            preferredActresses.some((name) => matchActress(name, m.title));
        }
      }

      return matchesSearch && matchesFav && matchesFavActress;
    });
 
    if (sortBy === 'actress') {
      // 依女優名稱 A-Z / 筆劃排序，無女優的排最後
      return [...result].sort((a, b) => {
        const nameA = a.actress || '';
        const nameB = b.actress || '';
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1;
        if (!nameB) return -1;
        return nameA.localeCompare(nameB, 'zh-Hant');
      });
    }

    if (sortBy === 'maker') {
      // 依廠商名稱 A-Z 排序，無廠商的排最後
      return [...result].sort((a, b) => {
        const makerA = a.maker || '';
        const makerB = b.maker || '';
        if (!makerA && !makerB) return 0;
        if (!makerA) return 1;
        if (!makerB) return -1;
        return makerA.localeCompare(makerB, 'zh-Hant');
      });
    }

    return result; // 'added' = DB 預設新增時間降冪順序 (created_at DESC)
  }, [
    movies, upcomingMovies, searchQuery, activeFavActress, showFavoritesOnly,
    showFavActressOnly, showUpcomingOnly, favActressSet, preferredActresses, isFavorite, sortBy,
  ]);
 
  // 篩選/搜尋/排序條件的指紋；變動時 MovieGrid 自動回到第一頁。
  // 刻意不含 favorites，避免單顆收藏 toggle 把分頁彈回第一頁。
  const pageResetKey = useMemo(
    () =>
      JSON.stringify([
        searchQuery,
        activeFavActress,
        showFavoritesOnly,
        showFavActressOnly,
        showUpcomingOnly,
        sortBy,
      ]),
    [searchQuery, activeFavActress, showFavoritesOnly, showFavActressOnly, showUpcomingOnly, sortBy]
  );
 
  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveFavActress('全部');
    setShowFavoritesOnly(false);
    setShowFavActressOnly(false);
    setShowUpcomingOnly(false);
    setSortBy('added');
  };

  const handleSelectMovie = (movie: Movie) => {
    setSelectedMovie(movie);
    // 記錄已瀏覽/點進去過的影片（避免兩週後被視為未讀清理）
    fetch('/api/movies/viewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: movie.code }),
    }).catch((err) => console.warn('Record view failed:', err));
  };

  const handleSubmitAdd = async (url: string) => {
    await addMovie.mutateAsync(url);
  };
 
  return (
    <main className="min-h-screen bg-background text-white font-inter selection:bg-indigo-500/30">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={availableFavActressesOrdered}
        activeCategory={activeFavActress}
        onCategoryChange={setActiveFavActress}
        showCategoryDropdown={showFavActressOnly && !showUpcomingOnly}
        dropdownLabel="女優篩選"
        dropdownGetLabel={(val) =>
          val === '全部' ? '全部喜愛女優' : `${val} (${favActressCounts[val] || 0})`
        }
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesOnly={() => {
          const next = !showFavoritesOnly;
          setShowFavoritesOnly(next);
          setShowFavActressOnly(false);
          setShowUpcomingOnly(false);
          setActiveFavActress('全部');
        }}
        showFavActressOnly={showFavActressOnly}
        onToggleFavActressOnly={() => {
          const next = !showFavActressOnly;
          setShowFavActressOnly(next);
          setShowFavoritesOnly(false);
          setShowUpcomingOnly(false);
          setActiveFavActress('全部');
        }}
        showUpcomingOnly={showUpcomingOnly}
        onToggleUpcomingOnly={() => {
          setShowUpcomingOnly((v) => !v);
          setShowFavoritesOnly(false);
          setShowFavActressOnly(false);
          setActiveFavActress('全部');
        }}
        onAddMovie={() => setAddOpen(true)}
        isAdding={addMovie.isPending}
        totalCount={filtered.length}
        searchInputRef={searchInputRef}
        sortBy={sortBy}
        onChangeSort={setSortBy}
        onResetFilters={handleResetFilters}
      />
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        <MovieGrid
          movies={filtered}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onSelectMovie={handleSelectMovie}
          resetKey={pageResetKey}
          onDeleteUpcoming={(code) => deleteUpcoming.mutate(code)}
        />
      </div>
      <MovieDetailModal
        movie={selectedMovie}
        onClose={() => setSelectedMovie(null)}
        onDeleteUpcoming={(code) => deleteUpcoming.mutate(code)}
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
