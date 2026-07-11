'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Filter, Search, SearchX } from 'lucide-react';
import { translateOption } from './FilterBar';
import { getActressVariants } from '@/lib/actress-matcher';

interface CategoryDropdownProps {
  options: string[];
  selected: string;
  onChange: (value: string) => void;
  label?: string;
  getLabel?: (value: string) => string;
}

/** 選項超過此數量才顯示搜尋框（分類模式選項少，不需要） */
const SEARCH_THRESHOLD = 8;

export function CategoryDropdown({ options, selected, onChange, label, getLabel }: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchable = options.length > SEARCH_THRESHOLD;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    if (searchable) {
      // AnimatePresence 進場後才 focus，避免動畫被打斷
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      if (opt === '全部') return true;
      if (opt.toLowerCase().includes(q)) return true;
      const shown = (getLabel ? getLabel(opt) : translateOption(opt)).toLowerCase();
      if (shown.includes(q)) return true;
      // 譯名變體也可搜（例：打「坂道」找到 miru）
      return getActressVariants(opt).some((v) => v.includes(q));
    });
  }, [options, query, getLabel]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group flex items-center gap-2 rounded-full border px-5 py-2.5 transition-all duration-200 ${
          open || selected !== '全部'
            ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200'
            : 'glass border-white/5 text-white/60 hover:border-white/20 hover:bg-white/5 hover:text-white'
        }`}
      >
        <Filter className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold tracking-wide">{label || '分類'}</span>
        <span className="max-w-[8rem] truncate text-xs font-semibold text-white/80">
          {getLabel ? getLabel(selected) : translateOption(selected)}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-white/10 bg-zinc-900/90 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            {searchable && (
              <div className="relative mb-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`搜尋${label || '分類'}…`}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 transition-all duration-200 focus:border-indigo-500/50 focus:bg-indigo-500/10 focus:outline-none"
                />
              </div>
            )}
            <ul role="listbox" className="max-h-72 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <li className="flex flex-col items-center gap-2 px-3 py-6 text-white/40">
                  <SearchX className="h-5 w-5" />
                  <span className="text-sm">找不到符合的選項</span>
                </li>
              ) : (
                filteredOptions.map((opt) => {
                  const active = opt === selected;
                  return (
                    <li key={opt}>
                      <button
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange(opt);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150 ${
                          active
                            ? 'bg-indigo-500/20 text-indigo-100'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{getLabel ? getLabel(opt) : translateOption(opt)}</span>
                        {active && <Check className="h-4 w-4 shrink-0 text-indigo-300" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
