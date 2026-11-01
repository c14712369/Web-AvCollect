'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Heart,
  Loader2,
  Search,
  Star,
  StarOff,
  Trash2,
  User,
} from 'lucide-react';
import type { Movie } from '@/types/av';
import { listActressNames, matchActress } from '@/lib/actress-matcher';
import { openMovieExternally } from '@/lib/open-movie';
import { useDeleteMovie } from '@/hooks/useMovies';
import { usePreferredActresses, useTogglePreferredActress } from '@/hooks/usePreferredActresses';

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

export interface ToastState {
  id: number;
  message: string;
  type: 'add' | 'remove' | 'copy';
}

const MENU_WIDTH = 270;
const EDGE = 12;
/** 刪除確認狀態維持多久後自動復原。 */
const CONFIRM_RESET_MS = 3000;

export function CardContextMenu({ state, onClose, favorited, onToggleFavorite, onDeleteUpcoming }: CardContextMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => setMounted(true), []);

  const showToast = (message: string, type: ToastState['type'] = 'add') => {
    setToast({ id: Date.now(), message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!mounted) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {state && (
          <MenuPanel
            key={`${state.movie.code}-${state.x}-${state.y}`}
            state={state}
            onClose={onClose}
            favorited={favorited}
            onToggleFavorite={onToggleFavorite}
            onDeleteUpcoming={onDeleteUpcoming}
            onShowToast={showToast}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <div
            className="pointer-events-none fixed inset-x-0 z-[130] flex justify-center px-4"
            style={{ bottom: 'max(1.75rem, calc(env(safe-area-inset-bottom) + 1rem))' }}
          >
            <motion.div
              key={toast.id}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-2.5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl"
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  toast.type === 'add'
                    ? 'bg-amber-500/20 text-amber-400'
                    : toast.type === 'remove'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {toast.type === 'add' ? (
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                ) : toast.type === 'remove' ? (
                  <StarOff className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </div>
              <span className="text-sm font-medium text-white">{toast.message}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}

function MenuPanel({
  state,
  onClose,
  favorited,
  onToggleFavorite,
  onDeleteUpcoming,
  onShowToast,
}: CardContextMenuProps & { state: CardMenuState; onShowToast: (msg: string, type: ToastState['type']) => void }) {
  const { movie } = state;
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: state.x, top: state.y, originX: 'left', originY: 'top' });
  const [confirming, setConfirming] = useState(false);
  const { mutate: deleteMovie, isPending: isDeleting, isError: deleteFailed, reset: resetDelete } = useDeleteMovie();
  const preferredActresses = usePreferredActresses();
  const { mutate: toggleActress } = useTogglePreferredActress();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const isUpcoming = movie.category === '預售新片';
  const actresses = listActressNames(movie.actress).slice(0, 3);
  const sheet = !!state.touch;

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

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

  /**
   * 判定此女優是否已在喜愛女優中：
   * 嚴格比對女優名（含中日變體與簡繁），避免片名中出現其他共演女優時發生跨人誤判。
   */
  const isActressPreferred = (actressName: string): boolean => {
    return preferredActresses.some(
      (pref) => matchActress(pref, actressName) || matchActress(actressName, pref)
    );
  };

  const handleToggleActress = (actressName: string, isFav: boolean) => {
    if (isFav) {
      const toRemove = preferredActresses.filter(
        (pref) => matchActress(pref, actressName) || matchActress(actressName, pref)
      );
      const targets = toRemove.length > 0 ? toRemove : [actressName];
      toggleActress({
        names: targets,
        action: 'remove',
      });
      onShowToast(`已將「${targets[0]}」從喜愛女優移除`, 'remove');
    } else {
      toggleActress({
        names: [actressName],
        action: 'add',
      });
      onShowToast(`已將「${actressName}」加入喜愛女優`, 'add');
    }
    onClose();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(movie.code);
      setCopiedCode(true);
      onShowToast(`已複製番號：${movie.code}`, 'copy');
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedCode(false);
        onClose();
      }, 400);
    } catch (err) {
      console.error('複製番號失敗', err);
      onShowToast('複製失敗：未獲剪貼簿權限', 'remove');
    }
  };

  const handleCopyTitle = async () => {
    try {
      await navigator.clipboard.writeText(movie.title);
      setCopiedTitle(true);
      onShowToast('已複製完整片名', 'copy');
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedTitle(false);
        onClose();
      }, 400);
    } catch (err) {
      console.error('複製片名失敗', err);
      onShowToast('複製失敗：未獲剪貼簿權限', 'remove');
    }
  };

  const handleGoogleSearch = () => {
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(movie.code)}`,
      '_blank',
      'noopener,noreferrer'
    );
    onClose();
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
      className={`group/menu fixed z-[120] max-h-[min(540px,calc(100vh-24px))] overflow-y-auto border border-white/10 bg-zinc-900/95 backdrop-blur-xl ${
        sheet
          ? 'inset-x-0 bottom-0 rounded-t-3xl border-b-0 px-3 pt-2 shadow-[0_-20px_60px_-12px_rgba(0,0,0,0.8)]'
          : 'rounded-2xl p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(0,0,0,0.4)]'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {sheet && <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-white/20" aria-hidden />}

      {/* 標頭：番號 + 片商 + 標題 */}
      <div className="px-2.5 pb-2 pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex rounded-md border border-indigo-400/25 bg-indigo-500/15 px-1.5 py-0.5 font-mono text-xs font-bold tracking-tight text-indigo-200">
            {movie.code}
          </span>
          {movie.maker && (
            <span className="truncate text-xs font-medium text-white/40 max-w-[120px]">
              {movie.maker}
            </span>
          )}
        </div>
        {movie.title && movie.title !== movie.code && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/50">{movie.title}</p>
        )}
      </div>

      <Divider />

      {/* 主要瀏覽 */}
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
          key={`works-${name}`}
          icon={<User className="h-4 w-4 text-rose-300/80" />}
          label={`${name} 的作品`}
          onClick={() => {
            onClose();
            router.push(`/actress/${encodeURIComponent(name)}`);
          }}
        />
      ))}

      <Divider />

      {/* 收藏與女優喜好 */}
      {!isUpcoming && (
        <MenuItem
          icon={<Heart className={`h-4 w-4 ${favorited ? 'fill-rose-500 text-rose-500' : ''}`} />}
          label={favorited ? '取消收藏' : '加入收藏'}
          onClick={() => {
            onToggleFavorite(movie.code);
            onShowToast(favorited ? `已取消收藏 ${movie.code}` : `已將 ${movie.code} 加入收藏`, favorited ? 'remove' : 'add');
            onClose();
          }}
        />
      )}

      {actresses.map((name) => {
        const isFav = isActressPreferred(name);
        return (
          <MenuItem
            key={`fav-${name}`}
            icon={
              isFav ? (
                <StarOff className="h-4 w-4 text-amber-400" />
              ) : (
                <Star className="h-4 w-4 text-amber-400" />
              )
            }
            label={isFav ? `從喜愛女優移除 (${name})` : `加入喜愛女優 (${name})`}
            onClick={() => handleToggleActress(name, isFav)}
          />
        );
      })}

      <Divider />

      {/* 快捷工具 */}
      <MenuItem
        icon={copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        label={copiedCode ? '已複製番號！' : `複製番號 (${movie.code})`}
        onClick={handleCopyCode}
      />

      {movie.title && (
        <MenuItem
          icon={copiedTitle ? <Check className="h-4 w-4 text-emerald-400" /> : <FileText className="h-4 w-4" />}
          label={copiedTitle ? '已複製片名！' : '複製完整片名'}
          onClick={handleCopyTitle}
        />
      )}

      <MenuItem
        icon={<Search className="h-4 w-4" />}
        label="Google 搜尋此番號"
        onClick={handleGoogleSearch}
      />

      <Divider />

      {/* 刪除操作 */}
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
      <span className="text-white/45 shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="mx-2 my-1 h-px bg-white/[0.06]" />;
}
