'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ExternalLink, Heart, Loader2, Trash2, User } from 'lucide-react';
import type { Movie } from '@/types/av';
import { listActressNames } from '@/lib/actress-matcher';
import { openMovieExternally } from '@/lib/open-movie';
import { useDeleteMovie } from '@/hooks/useMovies';

export interface CardMenuState {
  movie: Movie;
  x: number;
  y: number;
  /** 觸控長按叫出 → 底部面板；滑鼠右鍵 → 游標旁浮出選單。 */
  touch?: boolean;
}

interface CardContextMenuProps {
  state: CardMenuState | null;
  onClose: () => void;
  favorited: boolean;
  onToggleFavorite: (code: string) => void;
  onDeleteUpcoming?: (code: string) => void;
}

const MENU_WIDTH = 248;
const EDGE = 12;
/** 刪除確認狀態維持多久後自動復原。 */
const CONFIRM_RESET_MS = 3000;

export function CardContextMenu({ state, onClose, favorited, onToggleFavorite, onDeleteUpcoming }: CardContextMenuProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {state && (
        <MenuPanel
          key={`${state.movie.code}-${state.x}-${state.y}`}
          state={state}
          onClose={onClose}
          favorited={favorited}
          onToggleFavorite={onToggleFavorite}
          onDeleteUpcoming={onDeleteUpcoming}
        />
      )}
    </AnimatePresence>,
    document.body
  );
}

function MenuPanel({ state, onClose, favorited, onToggleFavorite, onDeleteUpcoming }: CardContextMenuProps & { state: CardMenuState }) {
  const { movie } = state;
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: state.x, top: state.y, originX: 'left', originY: 'top' });
  const [confirming, setConfirming] = useState(false);
  const { mutate: deleteMovie, isPending: isDeleting, isError: deleteFailed, reset: resetDelete } = useDeleteMovie();

  const isUpcoming = movie.category === '預售新片';
  const actresses = listActressNames(movie.actress).slice(0, 3);
  const sheet = !!state.touch;

  // 依實際尺寸夾在視窗內；靠右/靠下時改往左/上展開，縮放原點跟著游標
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (sheet) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    const flipX = state.x + w + EDGE > window.innerWidth;
    const flipY = state.y + h + EDGE > window.innerHeight;
    setPos({
      left: Math.max(EDGE, flipX ? state.x - w : state.x),
      top: Math.max(EDGE, flipY ? state.y - h : state.y),
      originX: flipX ? 'right' : 'left',
      originY: flipY ? 'bottom' : 'top',
    });
    el.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [state.x, state.y, sheet]);

  // 關閉後把焦點還給叫出選單的卡片（鍵盤使用者不會掉回頁首）
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      // 使用者已點到別處（如搜尋框）就不搶焦點；只有焦點落回 body 或還在選單內時才歸還
      const active = document.activeElement;
      const focusLost = !active || active === document.body || panelRef.current?.contains(active);
      if (focusLost && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // 點外面、Esc、捲動、縮放視窗都關閉；方向鍵在項目間移動
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    const close = () => onClose();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [onClose]);

  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), CONFIRM_RESET_MS);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const handleDelete = () => {
    if (!confirming) {
      resetDelete();
      return setConfirming(true);
    }
    if (isUpcoming && onDeleteUpcoming) {
      onDeleteUpcoming(movie.code);
      return onClose();
    }
    deleteMovie(movie.code, { onSuccess: onClose });
  };

  const panelMotion = sheet
    ? {
        initial: reduceMotion ? { opacity: 0 } : { transform: 'translateY(100%)' },
        animate: reduceMotion ? { opacity: 1 } : { transform: 'translateY(0%)' },
        exit: reduceMotion
          ? { opacity: 0, transition: { duration: 0.15 } }
          : { transform: 'translateY(100%)', transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } },
        transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] },
      }
    : {
        initial: reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: reduceMotion ? 1 : 0.98, transition: { duration: 0.1 } },
        transition: { duration: 0.14, ease: [0.23, 1, 0.32, 1] },
      };

  return (
    <>
    {sheet && (
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[119] bg-black/55 backdrop-blur-[2px]"
      />
    )}
    <motion.div
      ref={panelRef}
      role="menu"
      aria-label={`${movie.code} 操作`}
      {...panelMotion}
      style={
        sheet
          ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }
          : { left: pos.left, top: pos.top, width: MENU_WIDTH, transformOrigin: `${pos.originY} ${pos.originX}` }
      }
      data-sheet={sheet || undefined}
      className={`group/menu fixed z-[120] overflow-hidden border border-white/10 bg-zinc-900/95 backdrop-blur-xl ${
        sheet
          ? 'inset-x-0 bottom-0 rounded-t-3xl border-b-0 px-3 pt-2 shadow-[0_-20px_60px_-12px_rgba(0,0,0,0.8)]'
          : 'rounded-2xl p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(0,0,0,0.4)]'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {sheet && <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-white/20" aria-hidden />}

      {/* 標頭：番號 + 標題，讓使用者確認正在操作哪一部 */}
      <div className="px-2.5 pb-2 pt-1.5">
        <span className="inline-flex rounded-md border border-indigo-400/25 bg-indigo-500/15 px-1.5 py-0.5 font-mono text-xs font-bold tracking-tight text-indigo-200">
          {movie.code}
        </span>
        {movie.title && movie.title !== movie.code && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/50">{movie.title}</p>
        )}
      </div>

      <Divider />

      <MenuItem
        icon={<ExternalLink className="h-4 w-4" />}
        label={isUpcoming ? '前往官網' : '在新分頁開啟'}
        onClick={() => {
          openMovieExternally(movie);
          onClose();
        }}
      />

      {actresses.map((name) => (
        <MenuItem
          key={name}
          icon={<User className="h-4 w-4 text-rose-300/80" />}
          label={`${name} 的作品`}
          onClick={() => {
            onClose();
            router.push(`/actress/${encodeURIComponent(name)}`);
          }}
        />
      ))}

      {!isUpcoming && (
        <MenuItem
          icon={<Heart className={`h-4 w-4 ${favorited ? 'fill-rose-500 text-rose-500' : ''}`} />}
          label={favorited ? '取消收藏' : '加入收藏'}
          onClick={() => {
            onToggleFavorite(movie.code);
            onClose();
          }}
        />
      )}

      <Divider />

      <button
        type="button"
        role="menuitem"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-live="polite"
        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium outline-none group-data-[sheet]/menu:gap-3.5 group-data-[sheet]/menu:px-3 group-data-[sheet]/menu:py-3.5 group-data-[sheet]/menu:text-base transition-[background-color,color,transform] duration-150 active:scale-[0.98] disabled:opacity-60 ${
          confirming
            ? 'bg-rose-500 text-white shadow-[0_6px_20px_-6px_rgba(244,63,94,0.7)] focus-visible:bg-rose-500'
            : 'text-rose-400 hover:bg-rose-500/12 focus-visible:bg-rose-500/12'
        }`}
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        <span className="flex-1">
          {isDeleting ? '刪除中…' : confirming ? '再按一次確認刪除' : deleteFailed ? '刪除失敗，請重試' : isUpcoming ? '刪除預售片' : '刪除影片'}
        </span>
      </button>
    </motion.div>
    </>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-white/80 group-data-[sheet]/menu:gap-3.5 group-data-[sheet]/menu:px-3 group-data-[sheet]/menu:py-3.5 group-data-[sheet]/menu:text-base outline-none transition-[background-color,color,transform] duration-150 hover:bg-white/[0.07] hover:text-white focus-visible:bg-white/[0.07] focus-visible:text-white active:scale-[0.98]"
    >
      <span className="text-white/45">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="mx-2 my-1 h-px bg-white/[0.06]" />;
}
