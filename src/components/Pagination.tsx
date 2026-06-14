'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * 產生頁碼序列，過長時以省略號收斂：
 * 永遠保留第一頁、最後一頁，以及目前頁 ±1。
 */
function getPageRange(current: number, total: number): (number | 'ellipsis')[] {
  const pages = new Set<number>([1, total]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const range = getPageRange(currentPage, totalPages);

  const arrowBase =
    'flex h-11 min-w-11 items-center justify-center rounded-xl border text-sm font-semibold transition-all duration-200 active:scale-95';
  const arrowEnabled =
    'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white';
  const arrowDisabled = 'border-white/5 bg-white/[0.02] text-white/20 cursor-not-allowed';

  return (
    <nav
      aria-label="分頁導覽"
      className="mt-8 flex flex-wrap items-center justify-center gap-2 pb-4"
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={`${arrowBase} ${currentPage <= 1 ? arrowDisabled : arrowEnabled} px-3`}
        aria-label="上一頁"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {range.map((item, idx) =>
        item === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            className="flex h-11 min-w-11 items-center justify-center text-sm text-white/30"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            aria-current={item === currentPage ? 'page' : undefined}
            className={
              item === currentPage
                ? `${arrowBase} border-transparent bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 px-3`
                : `${arrowBase} ${arrowEnabled} px-3`
            }
          >
            {item}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={`${arrowBase} ${currentPage >= totalPages ? arrowDisabled : arrowEnabled} px-3`}
        aria-label="下一頁"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
