'use client';

import Link from 'next/link';
import { LayoutGrid, Heart, Plus, Loader2, Database, Calendar, Clock, Settings, Star, User, Building2, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { CategoryDropdown } from './CategoryDropdown';
import { SearchInput } from './SearchInput';
import { LogoutButton } from './LogoutButton';
import type { SortDirection, SortOption } from '@/lib/movie-sort';

export type { SortOption } from '@/lib/movie-sort';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  categories: string[];
  activeCategory: string;
  onCategoryChange: (v: string) => void;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  showFavActressOnly: boolean;
  onToggleFavActressOnly: () => void;
  showUpcomingOnly: boolean;
  onToggleUpcomingOnly: () => void;
  onAddMovie: () => void;
  isAdding: boolean;
  totalCount: number;
  searchInputRef?: React.Ref<HTMLInputElement>;
  sortBy: SortOption;
  sortDirection: SortDirection;
  onChangeSort?: (v: SortOption) => void;
  onResetFilters?: () => void;
  showCategoryDropdown?: boolean;
  dropdownLabel?: string;
  dropdownGetLabel?: (value: string) => string;
}

export function Header(props: HeaderProps) {
  const {
    searchQuery, onSearchChange,
    categories, activeCategory, onCategoryChange,
    showFavoritesOnly, onToggleFavoritesOnly,
    showFavActressOnly, onToggleFavActressOnly,
    showUpcomingOnly, onToggleUpcomingOnly,
    onAddMovie, isAdding, totalCount,
    searchInputRef,
    sortBy, sortDirection, onChangeSort,
    onResetFilters,
    showCategoryDropdown = false,
    dropdownLabel,
    dropdownGetLabel,
  } = props;

  const sortOptions: { key: SortOption; icon: React.ReactNode; label: string }[] = [
    { key: 'added', icon: <Clock className="h-3.5 w-3.5" />, label: '新增時間' },
    { key: 'actress', icon: <User className="h-3.5 w-3.5" />, label: '女優名稱' },
    { key: 'maker', icon: <Building2 className="h-3.5 w-3.5" />, label: '廠商' },
  ];
  const pickSort = (v: SortOption) => {
    if (onChangeSort) onChangeSort(v);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 glass">
      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 lg:px-10">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div 
              onClick={onResetFilters}
              className="flex items-center space-x-4 cursor-pointer select-none active:scale-95 hover:opacity-90 transition-all duration-200"
              title="重設所有篩選並回首頁"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-lg shadow-indigo-500/20">
                <LayoutGrid className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white leading-none">AvCollect</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SearchInput value={searchQuery} onChange={onSearchChange} inputRef={searchInputRef} />
              <Link
                href="/settings"
                className="flex h-9 w-9 items-center justify-center rounded-full glass border border-white/5 text-white/50 transition-all duration-200 hover:text-white hover:border-white/20"
                aria-label="標籤偏好設定"
                title="標籤偏好設定"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <LogoutButton />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
            <button
              onClick={onAddMovie}
              disabled={isAdding}
              className="group flex items-center space-x-2 rounded-full px-5 py-2.5 transition-all duration-500 border glass border-white/5 text-white/80 hover:text-white hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> : <Plus className="h-4 w-4 group-hover:scale-110 transition-transform text-indigo-400" />}
              <span className="text-xs font-bold tracking-wide">新增收藏</span>
            </button>
            <div
              role="radiogroup"
              aria-label="排序方式"
              className={`flex items-center gap-0.5 rounded-full glass border border-white/5 p-0.5 transition-all duration-300 ${
                showUpcomingOnly ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              {sortOptions.map((opt) => {
                const active = !showUpcomingOnly && opt.key === sortBy;
                return (
                  <button
                    key={opt.key}
                    role="radio"
                    aria-checked={active}
                    disabled={showUpcomingOnly}
                    onClick={() => pickSort(opt.key)}
                    title={showUpcomingOnly ? "預售新片不支援自訂排序" : opt.label}
                    className={
                      active
                        ? 'flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500/30 to-violet-500/30 px-3 py-2 text-violet-100 shadow-inner ring-1 ring-violet-400/30 transition-all'
                        : 'flex items-center gap-1.5 rounded-full px-3 py-2 text-white/50 transition-all hover:text-white hover:bg-white/5 disabled:hover:text-white/50'
                    }
                  >
                    {opt.icon}
                    <span className="text-xs font-bold tracking-wide">{opt.label}</span>
                    {active && (sortDirection === 'asc' ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" />)}
                  </button>
                );
              })}
            </div>
            <button
              onClick={onToggleFavActressOnly}
              className={`group flex items-center space-x-2 rounded-full px-5 py-2.5 transition-all duration-500 border ${
                showFavActressOnly
                  ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 shadow-[0_0_20px_rgba(236,72,153,0.2)]'
                  : 'glass border-white/5 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/5'
              }`}
              title="只看喜愛女優名單中的作品"
            >
              <Star className={`h-4 w-4 transition-all duration-500 ${showFavActressOnly ? 'fill-pink-400 scale-110' : 'group-hover:scale-110 group-hover:text-pink-400'}`} />
              <span className="text-xs font-semibold tracking-wide">喜愛女優</span>
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
            <button
              onClick={onToggleUpcomingOnly}
              className={`group flex items-center space-x-2 rounded-full px-5 py-2.5 transition-all duration-500 border ${
                showUpcomingOnly
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                  : 'glass border-white/5 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/5'
              }`}
              title="只看追蹤的官網預售新片"
            >
              <Calendar className={`h-4 w-4 transition-all duration-500 ${showUpcomingOnly ? 'scale-110' : 'group-hover:scale-110 group-hover:text-indigo-400'}`} />
              <span className="text-xs font-semibold tracking-wide">預售新片</span>
            </button>
            <div className="ml-auto flex items-center gap-3">
              {showCategoryDropdown && (
                <div className="animate-in fade-in duration-200">
                  <CategoryDropdown
                    options={categories}
                    selected={activeCategory}
                    onChange={onCategoryChange}
                    label={dropdownLabel}
                    getLabel={dropdownGetLabel}
                  />
                </div>
              )}
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
