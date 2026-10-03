'use client';

import Link from 'next/link';
import { LayoutGrid, Heart, Plus, Loader2, Calendar, Clock, Settings, Star, User, Building2, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
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

  const chip =
    'group flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-semibold tracking-wide transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60';
  const chipIdle = 'glass border-white/5 text-white/55 hover:border-white/20 hover:bg-white/5 hover:text-white';
  const iconButton =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/55 transition-[background-color,color,transform] duration-200 hover:bg-white/10 hover:text-white active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 glass">
      <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6 sm:pt-4 lg:px-10">
        {/* 第一列：Logo + 搜尋 + 設定/登出；手機收成單行 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onResetFilters}
            className="flex shrink-0 items-center gap-3 rounded-xl outline-none transition-transform duration-200 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            title="重設所有篩選並回首頁"
            aria-label="AvCollect：重設所有篩選"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-lg shadow-indigo-950/40">
              <LayoutGrid className="h-5 w-5 text-white" />
            </span>
            <span className="hidden text-xl font-bold leading-none tracking-tight text-white sm:inline">AvCollect</span>
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <SearchInput value={searchQuery} onChange={onSearchChange} inputRef={searchInputRef} />
            <Link href="/settings" className={iconButton} aria-label="標籤偏好設定" title="標籤偏好設定">
              <Settings className="h-4 w-4" />
            </Link>
            <LogoutButton className={iconButton} />
          </div>
        </div>

        {/* 第二列：操作與篩選；手機改橫向滑動，不再把 sticky header 撐到半個螢幕 */}
        <div className="mt-3 sm:mt-4 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:border-t sm:border-white/5 sm:pt-4">
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 no-scrollbar [mask-image:linear-gradient(to_right,#000_85%,transparent)] sm:contents">
          <button onClick={onAddMovie} disabled={isAdding} className={`${chip} glass border-white/5 text-white/85 hover:border-white/20 hover:bg-white/5 hover:text-white disabled:opacity-50`}>
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> : <Plus className="h-4 w-4 text-indigo-400" />}
            <span>新增收藏</span>
          </button>
          <div
            role="radiogroup"
            aria-label="排序方式"
            className={`flex h-10 shrink-0 items-center gap-0.5 rounded-full glass border border-white/5 p-1 transition-opacity duration-200 ${
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
                  title={showUpcomingOnly ? '預售新片不支援自訂排序' : opt.label}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold tracking-wide outline-none transition-[background-color,color] duration-200 focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                    active
                      ? 'bg-indigo-500/25 text-violet-100 ring-1 ring-inset ring-violet-400/30'
                      : 'text-white/55 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                  {active && (sortDirection === 'asc' ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" />)}
                </button>
              );
            })}
          </div>
          <button
            onClick={onToggleFavActressOnly}
            aria-pressed={showFavActressOnly}
            className={`${chip} ${showFavActressOnly ? 'border-pink-500/50 bg-pink-500/20 text-pink-200' : chipIdle}`}
            title="只看喜愛女優名單中的作品"
          >
            <Star className={`h-4 w-4 ${showFavActressOnly ? 'fill-pink-400 text-pink-400' : 'group-hover:text-pink-400'}`} />
            <span>喜愛女優</span>
          </button>
          <button
            onClick={onToggleFavoritesOnly}
            aria-pressed={showFavoritesOnly}
            className={`${chip} ${showFavoritesOnly ? 'border-rose-500/50 bg-rose-500/20 text-rose-200' : chipIdle}`}
          >
            <Heart className={`h-4 w-4 ${showFavoritesOnly ? 'fill-rose-500 text-rose-500' : 'group-hover:text-rose-400'}`} />
            <span>收藏限定</span>
          </button>
          <button
            onClick={onToggleUpcomingOnly}
            aria-pressed={showUpcomingOnly}
            className={`${chip} ${showUpcomingOnly ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200' : chipIdle}`}
            title="只看追蹤的官網預售新片"
          >
            <Calendar className={`h-4 w-4 ${showUpcomingOnly ? 'text-indigo-300' : 'group-hover:text-indigo-400'}`} />
            <span>預售新片</span>
          </button>
        </div>
          {/* 不放進捲動列：下拉選單是 absolute，會被 overflow 裁掉 */}
          <div className="mt-2 flex items-center justify-between gap-3 sm:ml-auto sm:mt-0">
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
            <p className="whitespace-nowrap px-1 text-xs text-white/45" aria-live="polite">
              <span className="text-sm font-bold tabular-nums text-indigo-300">{totalCount.toLocaleString('zh-TW')}</span> 部
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
