'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart, ImageOff, Target, Trash2 } from 'lucide-react';
import { Movie } from '@/types/av';
import { upgradeImageUrl } from '@/lib/utils';

interface AvCardProps {
  movie: Movie;
  favorited: boolean;
  onToggleFavorite: (code: string) => void;
  /** 左鍵/Enter：直接在新分頁開啟。 */
  onOpen: (movie: Movie) => void;
  /** 右鍵 / 觸控長按 / 鍵盤選單鍵：叫出操作選單。 */
  onOpenMenu: (movie: Movie, x: number, y: number) => void;
  onDeleteUpcoming?: (code: string) => void;
}

/** 觸控長按多久叫出選單（iOS Safari 不會觸發 contextmenu，需自己判斷）。 */
const LONG_PRESS_MS = 480;
const LONG_PRESS_TOLERANCE = 10;

export const AvCard: React.FC<AvCardProps> = ({ movie, favorited, onToggleFavorite, onOpen, onOpenMenu, onDeleteUpcoming }) => {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(movie.code);
  };

  const pressTimer = React.useRef<number | null>(null);
  const pressStart = React.useRef<{ x: number; y: number } | null>(null);
  // 長按叫出選單後，放開手指產生的 click 不能再開分頁
  const suppressClick = React.useRef(false);

  const cancelPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    suppressClick.current = false;
    if (e.pointerType !== 'touch') return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    const { clientX, clientY } = e;
    pressTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      navigator.vibrate?.(8);
      onOpenMenu(movie, clientX, clientY);
      cancelPress();
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = pressStart.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > LONG_PRESS_TOLERANCE) cancelPress();
  };

  React.useEffect(() => cancelPress, []);

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Android 長按會同時觸發計時器與原生 contextmenu，計時器已開過就不重開
    if (suppressClick.current) return;
    const isTouch = pressStart.current !== null;
    cancelPress();
    suppressClick.current = isTouch;
    // 鍵盤選單鍵 / Shift+F10 沒有座標 → 錨在卡片左上
    if (e.clientX === 0 && e.clientY === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      return onOpenMenu(movie, rect.left + 16, rect.top + 16);
    }
    onOpenMenu(movie, e.clientX, e.clientY);
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onOpen(movie);
  };

  const initialUrl = upgradeImageUrl(movie.imageUrl, movie.source);
  const [imgSrc, setImgSrc] = React.useState(initialUrl);
  const [imgError, setImgError] = React.useState(!movie.imageUrl);
  const [retried, setRetried] = React.useState(false);

  const handleImgError = () => {
    if (!retried && imgSrc !== movie.imageUrl && movie.imageUrl) {
      setRetried(true);
      setImgSrc(movie.imageUrl);
    } else {
      setImgError(true);
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`${movie.code} ${movie.title}（右鍵或長按開啟選單）`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] active:scale-[0.99] cursor-pointer select-none [-webkit-touch-callout:none] outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      onClick={handleClick}
      onAuxClick={(e) => {
        if (e.button === 1) onOpen(movie);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(movie);
      }}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
    >
      {/* Image Container - 16:9 寬幅封面（預售片為 3:4 直式）；用 cover 填滿整個卡片，超出範圍裁切不留黑邊 */}
      <div className={`relative w-full overflow-hidden bg-zinc-900 ${movie.category === '預售新片' ? 'aspect-[3/4]' : 'aspect-[16/9]'}`}>
        {imgError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900/40 via-zinc-900 to-violet-900/30 p-4">
            <ImageOff className="h-6 w-6 text-white/20 mb-2" />
            <div className="text-[10px] font-mono font-bold text-indigo-300/70 mb-2 tracking-wider">
              {movie.code}
            </div>
            <div className="text-xs font-semibold text-white/80 line-clamp-4 text-center leading-snug">
              {movie.title}
            </div>
          </div>
        ) : (
          <Image
            src={imgSrc}
            alt={movie.title}
            fill
            unoptimized
            referrerPolicy="no-referrer"
            draggable={false}
            onError={handleImgError}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-40" />

        {/* 收藏 / 預售新片刪除按鈕 */}
        {movie.category === '預售新片' && onDeleteUpcoming ? (
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteUpcoming(movie.code);
            }}
            className="absolute top-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/5 transition-colors hover:bg-rose-500/40"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleFavoriteClick}
            className="absolute top-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/5 transition-colors hover:bg-black/60"
          >
            <Heart
              className={`h-3.5 w-3.5 transition-colors ${favorited ? 'fill-red-500 text-red-500' : 'text-white/70'}`}
            />
          </motion.button>
        )}

        {/* 口味契合度徽章（僅 high / medium 顯示，避免雜訊） */}
        {movie.matchTier && movie.matchTier !== 'low' && movie.matchScore != null && (
          <div
            className={`absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-black backdrop-blur-md ${
              movie.matchTier === 'high'
                ? 'border-violet-400/40 bg-violet-500/30 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.45)]'
                : 'border-teal-400/30 bg-teal-500/25 text-teal-100'
            }`}
            title={movie.matchReasons?.length ? `契合：${movie.matchReasons.join('、')}` : '口味契合度'}
          >
            <Target className="h-3 w-3" />
            {movie.matchScore}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex flex-col gap-1.5 p-3">
        {/* 預售新片：顯示番號與預計發售日 */}
        {movie.category === '預售新片' && (
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded bg-indigo-500/20 px-1.5 py-0.5 text-xs font-black tracking-tighter text-indigo-300 border border-indigo-500/30">
              {movie.code}
            </span>
            {movie.releaseDate && (
              <span className="text-xs font-semibold text-white/40">{movie.releaseDate} 發售</span>
            )}
          </div>
        )}
        <h3 className="truncate text-sm font-semibold leading-snug text-white/90 group-hover:text-white transition-colors" title={movie.title}>
          {movie.title}
        </h3>
        {(movie.actress || movie.themes.length > 0) && (
          <p className="truncate text-xs text-white/45">
            {movie.actress && <span className="text-rose-300/80">{movie.actress}</span>}
            {movie.actress && movie.themes.length > 0 && (
              <span className="mx-1.5 text-white/20">|</span>
            )}
            {movie.themes.slice(0, 3).join('・')}
          </p>
        )}
      </div>
    </div>
  );
};

export default AvCard;
