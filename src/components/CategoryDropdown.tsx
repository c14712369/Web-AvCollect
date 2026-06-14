'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Filter } from 'lucide-react';
import { translateOption } from './FilterBar';

interface CategoryDropdownProps {
  options: string[];
  selected: string;
  onChange: (value: string) => void;
}

export function CategoryDropdown({ options, selected, onChange }: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <span className="text-xs font-bold tracking-wide">分類</span>
        <span className="max-w-[8rem] truncate text-xs font-semibold text-white/80">
          {translateOption(selected)}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 max-h-80 w-56 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/90 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            {options.map((opt) => {
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
                    <span className="truncate">{translateOption(opt)}</span>
                    {active && <Check className="h-4 w-4 shrink-0 text-indigo-300" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
