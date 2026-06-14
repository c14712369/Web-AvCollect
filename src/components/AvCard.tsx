'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart, ImageOff, Target } from 'lucide-react';
import { Movie } from '@/types/av';
import { upgradeImageUrl } from '@/lib/utils';

interface AvCardProps {
  movie: Movie;
  favorited: boolean;
  onToggleFavorite: (code: string) => void;
  onSelect: (movie: Movie) => void;
}

export const AvCard: React.FC<AvCardProps> = ({ movie, favorited, onToggleFavorite, onSelect }) => {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(movie.code);
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
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] cursor-pointer"
      onClick={() => onSelect(movie)}
    >
      {/* Image Container - 16:9 寬幅封面（仿 Jable）；用 cover 填滿整個卡片，超出範圍裁切不留黑邊 */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-900">
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
            onError={handleImgError}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-40" />

        {/* Favorite Button */}
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
