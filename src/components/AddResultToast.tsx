'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Heart, Search, X } from 'lucide-react';
import type { Movie } from '@/types/av';
import type { AddMovieOutcome } from '@/hooks/useMovies';

export interface AddResult {
  movie: Movie;
  outcome: AddMovieOutcome;
  /** 每次新增都換一個 id，同一部片連加兩次也會重新計時。 */
  id: number;
}

const OUTCOME_COPY: Record<AddMovieOutcome, string> = {
  inserted: '新片已加入片庫',
  upgraded: '片庫已有此片，已補齊資料',
  existing: '片庫已有此片',
};

const AUTO_DISMISS_MS = 5000;

interface Props {
  result: AddResult | null;
  onDismiss: () => void;
  onShow: (code: string) => void;
}

export function AddResultToast({ result, onDismiss, onShow }: Props) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!result) return;
    const t = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [result, onDismiss]);

  if (!mounted) return null;

  // 掛到 body：外層有 transform 的容器會讓 fixed 改以它為定位基準，提示就跑出畫面外
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[110] flex justify-center px-4">
      <AnimatePresence>
        {result && (
          <motion.div
            key={result.id}
            role="status"
            aria-live="polite"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(16px) scale(0.98)' }}
            animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
            exit={{ opacity: 0, transform: reduceMotion ? 'none' : 'translateY(8px) scale(0.98)', transition: { duration: 0.15 } }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/90 py-2.5 pl-3 pr-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75)] backdrop-blur-xl"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15">
              <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                已加入收藏 <span className="font-mono text-indigo-200">{result.movie.code}</span>
              </p>
              <p className="truncate text-xs text-white/45">{OUTCOME_COPY[result.outcome]}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onShow(result.movie.code);
                onDismiss();
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.07] px-3 py-2 text-xs font-bold text-white/85 transition-[background-color,transform] duration-150 hover:bg-white/[0.12] active:scale-[0.97]"
            >
              <Search className="h-3.5 w-3.5" />
              顯示
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="關閉"
              className="shrink-0 rounded-lg p-2 text-white/35 transition-colors hover:text-white/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
