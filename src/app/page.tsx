'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Info, Heart, Plus, Loader2 } from 'lucide-react';

import { movies as initialMovies } from '@/lib/data';
import { AvCard } from '@/components/AvCard';
import { FilterBar } from '@/components/FilterBar';
import { SearchInput } from '@/components/SearchInput';
import { useFavorites } from '@/hooks/useFavorites';

export default function Home() {
  const [movies, setMovies] = useState(initialMovies);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSource, setActiveSource] = useState('全部');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [activeMaker, setActiveMaker] = useState('全部');
  const [activeTheme, setActiveTheme] = useState('全部');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { isFavorite } = useFavorites();

  const handleAddMovie = async () => {
    const url = window.prompt('請輸入影片網址 (Jable, MissAV, Javrate)：');
    if (!url) return;

    setIsAdding(true);
    try {
      const res = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.success) {
        setMovies(prev => [data.movie, ...prev]);
        alert('新增成功！');
      } else {
        alert('新增失敗：' + data.error);
      }
    } catch (e) {
      alert('發生錯誤');
    } finally {
      setIsAdding(false);
    }
  };

  // Derive filter options
  const sources = useMemo(() => ['全部', ...Array.from(new Set(movies.map(m => m.source)))], [movies]);
  const categories = useMemo(() => ['全部', ...Array.from(new Set(movies.map(m => m.category)))], [movies]);
  const makers = useMemo(() => ['全部', ...Array.from(new Set(movies.map(m => m.maker))).sort()], [movies]);
  
  // Collect all unique themes
  const themes = useMemo(() => {
    const allThemes = new Set<string>();
    movies.forEach(m => m.themes.forEach(t => allThemes.add(t)));
    return ['全部', ...Array.from(allThemes).sort()];
  }, [movies]);

  // Filter logic
  const filteredMovies = useMemo(() => {
    return movies.filter(movie => {
      const matchesSearch = 
        movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movie.code.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSource = activeSource === '全部' || movie.source === activeSource;
      const matchesCategory = activeCategory === '全部' || movie.category === activeCategory;
      const matchesMaker = activeMaker === '全部' || movie.maker === activeMaker;
      const matchesTheme = activeTheme === '全部' || movie.themes.includes(activeTheme);
      const matchesFavorite = !showFavoritesOnly || isFavorite(movie.code);

      return matchesSearch && matchesSource && matchesCategory && matchesMaker && matchesTheme && matchesFavorite;
    });
  }, [searchQuery, activeSource, activeCategory, activeMaker, activeTheme, showFavoritesOnly, isFavorite, movies]);

  return (
    <main className="min-h-screen bg-[#050505] text-white font-inter selection:bg-indigo-500/30">
      {/* Sticky Header Section */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 glass">
        <div className="mx-auto max-w-[1920px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col space-y-4">
            {/* Top Bar: Title & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-lg shadow-indigo-500/20">
                  <LayoutGrid className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white leading-none">AvCollect</h1>
                  <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest mt-0.5">頂級數位資產典藏庫</p>
                </div>
              </div>

              <SearchInput value={searchQuery} onChange={setSearchQuery} />
            </div>

            {/* Bottom Bar: Filters & Count */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-t border-white/5 pt-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full xl:pr-8 min-w-0">
                <FilterBar label="來源" options={sources} selected={activeSource} onChange={setActiveSource} />
                <FilterBar label="分類" options={categories} selected={activeCategory} onChange={setActiveCategory} />
                <FilterBar label="廠商" options={makers} selected={activeMaker} onChange={setActiveMaker} />
                <FilterBar label="主題" options={themes} selected={activeTheme} onChange={setActiveTheme} />
              </div>

              <div className="flex items-center space-x-3 self-end xl:self-auto shrink-0">
                {/* Add Movie Toggle */}
                <button
                  onClick={handleAddMovie}
                  disabled={isAdding}
                  className="group flex items-center space-x-2 rounded-full px-5 py-2.5 transition-all duration-500 border glass border-white/5 text-white/80 hover:text-white hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
                >
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> : <Plus className="h-4 w-4 group-hover:scale-110 transition-transform text-indigo-400" />}
                  <span className="text-xs font-bold tracking-wide">新增收藏</span>
                </button>
                {/* Favorites Toggle */}
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`group flex items-center space-x-2 rounded-full px-5 py-2.5 transition-all duration-500 border ${
                    showFavoritesOnly 
                      ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                      : 'glass border-white/5 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <Heart 
                    className={`h-4 w-4 transition-all duration-500 ${
                      showFavoritesOnly 
                        ? 'fill-red-500 scale-110' 
                        : 'group-hover:scale-110 group-hover:text-red-400'
                    }`} 
                  />
                  <span className="text-xs font-semibold tracking-wide">收藏限定</span>
                </button>

                <div className="flex items-center space-x-2 rounded-full glass border-white/5 px-5 py-2.5">
                  <span className="text-xs font-medium text-white/30 uppercase tracking-tighter">總計</span>
                  <span className="text-sm font-bold text-indigo-400 font-mono">
                    {filteredMovies.length.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content: Grid */}
      <div className="mx-auto max-w-[1920px] px-4 py-8 sm:px-6 lg:px-8">
        <AnimatePresence mode="popLayout">
          {filteredMovies.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10"
            >

              {filteredMovies.map((movie) => (
                <motion.div
                  key={movie.code}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <AvCard movie={movie} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
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
          )}
        </AnimatePresence>
      </div>

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-1/4 h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>
    </main>
  );
}
