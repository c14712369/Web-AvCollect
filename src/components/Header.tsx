'use client';

import { LayoutGrid, Heart, Plus, Loader2 } from 'lucide-react';
import { FilterBar } from './FilterBar';
import { SearchInput } from './SearchInput';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  sources: string[];
  categories: string[];
  makers: string[];
  themes: string[];
  activeSource: string;
  activeCategory: string;
  activeMaker: string;
  activeTheme: string;
  onSourceChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onMakerChange: (v: string) => void;
  onThemeChange: (v: string) => void;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  onAddMovie: () => void;
  isAdding: boolean;
  totalCount: number;
}

export function Header(props: HeaderProps) {
  const {
    searchQuery, onSearchChange,
    sources, categories, makers, themes,
    activeSource, activeCategory, activeMaker, activeTheme,
    onSourceChange, onCategoryChange, onMakerChange, onThemeChange,
    showFavoritesOnly, onToggleFavoritesOnly,
    onAddMovie, isAdding, totalCount,
  } = props;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 glass">
      <div className="mx-auto max-w-[1920px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col space-y-4">
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
            <div className="flex items-center gap-3">
              <SearchInput value={searchQuery} onChange={onSearchChange} />
              <ThemeToggle />
            </div>
          </div>

          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-t border-white/5 pt-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full xl:pr-8 min-w-0">
              <FilterBar label="來源" options={sources} selected={activeSource} onChange={onSourceChange} />
              <FilterBar label="分類" options={categories} selected={activeCategory} onChange={onCategoryChange} />
              <FilterBar label="廠商" options={makers} selected={activeMaker} onChange={onMakerChange} />
              <FilterBar label="主題" options={themes} selected={activeTheme} onChange={onThemeChange} />
            </div>
            <div className="flex items-center space-x-3 self-end xl:self-auto shrink-0">
              <button
                onClick={onAddMovie}
                disabled={isAdding}
                className="group flex items-center space-x-2 rounded-full px-5 py-2.5 transition-all duration-500 border glass border-white/5 text-white/80 hover:text-white hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
              >
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> : <Plus className="h-4 w-4 group-hover:scale-110 transition-transform text-indigo-400" />}
                <span className="text-xs font-bold tracking-wide">新增收藏</span>
              </button>
              <button
                onClick={onToggleFavoritesOnly}
                className={`group flex items-center space-x-2 rounded-full px-5 py-2.5 transition-all duration-500 border ${
                  showFavoritesOnly
                    ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                    : 'glass border-white/5 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <Heart className={`h-4 w-4 transition-all duration-500 ${showFavoritesOnly ? 'fill-red-500 scale-110' : 'group-hover:scale-110 group-hover:text-red-400'}`} />
                <span className="text-xs font-semibold tracking-wide">收藏限定</span>
              </button>
              <div className="flex items-center space-x-2 rounded-full glass border-white/5 px-5 py-2.5">
                <span className="text-xs font-medium text-white/30 uppercase tracking-tighter">總計</span>
                <span className="text-sm font-bold text-indigo-400 font-mono">
                  {totalCount.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
