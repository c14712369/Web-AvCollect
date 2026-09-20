'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
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
import { ACTRESS_SPLIT_REGEX, countActressAppearances, matchActress } from '@/lib/actress-matcher';
import { sortMovies, type SortDirection } from '@/lib/movie-sort';
import { toIsoTimestamp } from '@/lib/client-state';
import { shouldFetchUpcoming, UPCOMING_PREFETCH_DELAY_MS } from '@/lib/interaction-performance';

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
  const [isUpcomingLoadPending, setUpcomingLoadPending] = useState(false);
  const [upcomingPrefetchReady, setUpcomingPrefetchReady] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('added');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [isSwitchingView, startViewTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 篩選、排序與分頁屬於可延後的畫面切換：先讓載入遮罩繪製，再更新卡片清單。
  const switchView = (action: () => void) => startViewTransition(action);
 
  // 首頁穩定後在背景預抓預售資料；使用者若先點擊，仍立即請求。
  useEffect(() => {
    const timer = window.setTimeout(() => setUpcomingPrefetchReady(true), UPCOMING_PREFETCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // 預售新片
  const {
    data: upcomingMovies = [],
    isLoading: upcomingLoading,
    isFetching: upcomingFetching,
    isSuccess: upcomingLoaded,
    isError: upcomingFailed,
  } = useUpcomingMovies({
    enabled: shouldFetchUpcoming(upcomingPrefetchReady, showUpcomingOnly),
  });
  const deleteUpcoming = useDeleteUpcomingMovie();

  // 點擊當下先開啟遮罩，避免 query 尚未回報 isLoading 前先短暫渲染空清單。
  const toggleUpcomingView = () => {
    if (!showUpcomingOnly) setUpcomingLoadPending(true);
    switchView(() => {
      setShowUpcomingOnly((v) => !v);
      setShowFavoritesOnly(false);
      setShowFavActressOnly(false);
      setActiveFavActress('全部');
    });
  };

  useEffect(() => {
    if (!showUpcomingOnly || ((upcomingLoaded || upcomingFailed) && !upcomingLoading && !upcomingFetching)) {
      setUpcomingLoadPending(false);
    }
  }, [showUpcomingOnly, upcomingLoading, upcomingFetching, upcomingLoaded, upcomingFailed]);
 
  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      meta: true,
      handler: () => searchInputRef.current?.focus(),
    },
    {
      key: 'f',
      handler: () => switchView(() => setShowFavoritesOnly((v) => !v)),
    },
    {
      key: 'a',
      handler: () => switchView(() => {
        setShowFavActressOnly((prev) => {
          if (prev) setActiveFavActress('全部');
          return !prev;
        });
      }),
    },
    {
      key: 'u',
      handler: toggleUpcomingView,
    },
  ]);

  const favoriteMovies = useMemo(() => {
    return movies.filter((m) => isFavorite(m.code));
  }, [movies, isFavorite]);

  const favActressSet = useMemo(
    () => new Set(preferredActresses.map((a) => a.trim().toLowerCase()).filter(Boolean)),
    [preferredActresses]
  );

  // 收藏限定時可從所有收藏作品篩女優；一般「喜愛女優」模式僅列手動追蹤名單。
  const favActressCounts = useMemo(() => {
    if (showFavoritesOnly) {
      return countActressAppearances(favoriteMovies.map((m) => m.actress));
    }
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
  }, [showFavoritesOnly, showFavActressOnly, favoriteMovies, preferredActresses, movies]);

  // 女優篩選下拉選單選項（按 A-Z / 筆劃排序）
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
          addedAt: toIsoTimestamp(m.createdAt),
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

      // 收藏限定與喜愛女優模式都可搭配女優篩選。
      let matchesFavActress = true;
      if (activeFavActress !== '全部' && (showFavoritesOnly || showFavActressOnly)) {
        matchesFavActress =
          (!!m.actress && matchActress(activeFavActress, m.actress)) ||
          matchActress(activeFavActress, m.title);
      } else if (showFavActressOnly) {
        matchesFavActress =
          (!!m.actress &&
            m.actress
              .split(ACTRESS_SPLIT_REGEX)
              .map((a) => a.toLowerCase().trim())
              .filter(Boolean)
              .some((a) => favActressSet.has(a))) ||
          preferredActresses.some((name) => matchActress(name, m.title));
      }

      return matchesSearch && matchesFav && matchesFavActress;
    });
 
    return sortMovies(result, sortBy, sortDirection);
  }, [
    movies, upcomingMovies, searchQuery, activeFavActress, showFavoritesOnly,
    showFavActressOnly, showUpcomingOnly, favActressSet, preferredActresses, isFavorite, sortBy, sortDirection,
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
        sortDirection,
      ]),
    [searchQuery, activeFavActress, showFavoritesOnly, showFavActressOnly, showUpcomingOnly, sortBy, sortDirection]
  );
 
  const handleResetFilters = () => switchView(() => {
    setSearchQuery('');
    setActiveFavActress('全部');
    setShowFavoritesOnly(false);
    setShowFavActressOnly(false);
    setShowUpcomingOnly(false);
    setSortBy('added');
    setSortDirection('desc');
  });

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
        onCategoryChange={(value) => switchView(() => setActiveFavActress(value))}
        showCategoryDropdown={(showFavoritesOnly || showFavActressOnly) && !showUpcomingOnly}
        dropdownLabel="女優篩選"
        dropdownGetLabel={(val) =>
          val === '全部'
            ? showFavoritesOnly ? '全部收藏女優' : '全部喜愛女優'
            : `${val} (${favActressCounts[val] || 0})`
        }
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesOnly={() => switchView(() => {
          const next = !showFavoritesOnly;
          setShowFavoritesOnly(next);
          setShowUpcomingOnly(false);
          if (!next && !showFavActressOnly) setActiveFavActress('全部');
        })}
        showFavActressOnly={showFavActressOnly}
        onToggleFavActressOnly={() => switchView(() => {
          const next = !showFavActressOnly;
          setShowFavActressOnly(next);
          setShowUpcomingOnly(false);
          if (!next && !showFavoritesOnly) setActiveFavActress('全部');
        })}
        showUpcomingOnly={showUpcomingOnly}
        onToggleUpcomingOnly={toggleUpcomingView}
        onAddMovie={() => setAddOpen(true)}
        isAdding={addMovie.isPending}
        totalCount={filtered.length}
        searchInputRef={searchInputRef}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onChangeSort={(nextSort) => switchView(() => {
          if (nextSort === sortBy) {
            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
          } else {
            setSortBy(nextSort);
            setSortDirection(nextSort === 'added' ? 'desc' : 'asc');
          }
        })}
        onResetFilters={handleResetFilters}
      />
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        <MovieGrid
          movies={filtered}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onSelectMovie={handleSelectMovie}
          resetKey={pageResetKey}
          onPageChange={(navigate) => switchView(navigate)}
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
      {(isSwitchingView || isUpcomingLoadPending || (showUpcomingOnly && upcomingLoading)) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/75 px-6 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label="正在切換畫面"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-400/25 bg-zinc-900/90 px-5 py-4 shadow-2xl shadow-indigo-950/50">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{isUpcomingLoadPending || upcomingLoading ? '正在抓取預售新片' : '正在切換畫面'}</p>
              <p className="mt-0.5 text-xs text-white/45">請稍候，暫時無法操作其他功能</p>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-1/4 h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>
    </main>
  );
}
