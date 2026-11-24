'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ImageOff, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import type { TrashedMovie } from '@/lib/db/movie-trash';

const DAY_MS = 24 * 60 * 60 * 1000;
/** 剩這幾天以內就用琥珀色提醒「快被永久移除了」。 */
const URGENT_DAYS = 3;

const daysLeft = (expiresAt: string) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS));

function Thumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(!src);
  return (
    <div className="relative aspect-[3/2] w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-900 sm:w-24">
      {failed ? (
        <div className="flex h-full items-center justify-center">
          <ImageOff className="h-4 w-4 text-white/20" />
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailed(true)}
          className="object-cover"
          sizes="96px"
        />
      )}
    </div>
  );
}

/** 設定頁「維護」分頁：自動清理移走的片，保留期內可單部還原。 */
export function TrashCard() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<TrashedMovie[] | null>(null);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/movies/trash');
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? '讀取回收桶失敗');
      setItems(data.items);
      setRetentionDays(data.retentionDays);
      setError('');
    } catch (e) {
      // 讀取失敗保留 items 為 null（未知），不當成「回收桶是空的」
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const restore = async (code: string) => {
    setRestoring(code);
    setError('');
    try {
      const res = await fetch('/api/movies/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? '還原失敗');
      setItems((prev) => prev?.filter((m) => m.code !== code) ?? prev);
      queryClient.invalidateQueries({ queryKey: ['movies'] });
    } catch (e) {
      setError(`${code} 還原失敗：${(e as Error).message}`);
    } finally {
      setRestoring(null);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <div className="mb-1 flex items-center gap-2">
        <Trash2 className="h-4 w-4 text-amber-300" />
        <h2 className="text-base font-semibold">回收桶</h2>
        {items && items.length > 0 && (
          <span className="text-sm tabular-nums text-white/35">{items.length}</span>
        )}
      </div>
      <p className="mb-4 text-sm text-white/40">
        入庫滿 14 天沒點過、沒收藏的片會移到這裡，保留 {retentionDays} 天；還原後記為看過，不會再被清。
      </p>

      {error && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          <span>{error}</span>
          <button
            onClick={refresh}
            className="flex h-11 shrink-0 items-center rounded-xl px-3 font-medium text-rose-200 transition-all duration-200 hover:bg-rose-500/20 active:scale-95"
          >
            重新讀取
          </button>
        </div>
      )}

      {loading && items === null ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-2">
              <div className="aspect-[3/2] w-20 shrink-0 animate-pulse rounded-lg bg-white/5 sm:w-24" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : items && items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-white/30">
          回收桶是空的
        </p>
      ) : items ? (
        <ul className="-mx-2 max-h-[26rem] space-y-1 overflow-y-auto overscroll-contain px-2">
          <AnimatePresence initial={false}>
            {items.map((m) => {
              const left = daysLeft(m.expiresAt);
              const busy = restoring === m.code;
              return (
                <motion.li
                  key={m.code}
                  layout
                  exit={{ opacity: 0, x: 24, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors duration-200 hover:bg-white/5"
                >
                  <Thumb src={m.imageUrl} alt={m.title} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs leading-none">
                      <span className="font-mono font-bold tracking-wide text-indigo-300/80">{m.code}</span>
                      <span
                        className={`tabular-nums ${left <= URGENT_DAYS ? 'text-amber-300' : 'text-white/35'}`}
                        title={`移入時間 ${new Date(m.deletedAt).toLocaleString('zh-TW')}`}
                      >
                        剩 {left} 天
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-white/75 sm:line-clamp-1">{m.title}</p>
                  </div>
                  <button
                    onClick={() => restore(m.code)}
                    disabled={restoring !== null}
                    aria-label={`還原 ${m.code}`}
                    className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-sm font-medium text-white/80 transition-all duration-200 hover:border-indigo-400/40 hover:bg-indigo-500/15 hover:text-white active:scale-95 disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    還原
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : null}
    </section>
  );
}
