'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ExternalLink, Heart, ImageOff } from 'lucide-react';
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
      {/* Image Container - 3:4 portrait ratio fits AV covers properly */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900">
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
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 15vw"
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
      </div>

      {/* Content Area */}
      <div className="flex flex-col p-3 space-y-2 flex-1">
        <div className="flex items-center justify-between">
          <span className="inline-flex rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-black tracking-tighter text-indigo-300 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
            {movie.code}
          </span>
          <ExternalLink className="h-3 w-3 text-white/20 group-hover:text-white/60 transition-colors" />
        </div>

        <h3 className="line-clamp-2 text-xs font-bold leading-tight text-white/90 group-hover:text-white transition-colors" title={movie.title}>
          {movie.title}
        </h3>

        {/* Tags Row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <div className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white/70 border border-white/10 uppercase">
            {movie.source}
          </div>
          {movie.maker && (
            <div className="rounded bg-indigo-500/30 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-indigo-200 border border-indigo-500/30 uppercase">
              {movie.maker}
            </div>
          )}
          <div className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-rose-300 border border-rose-500/20 truncate max-w-[80px]">
            {movie.category === 'ActressMatched' ? '追蹤女優' :
             movie.category === 'TagMatched' ? '追蹤標籤' :
             movie.category === 'DailyHot' ? '日熱門' :
             movie.category === 'WeeklyHot' ? '週熱門' :
             movie.category === 'New' ? '最新' : movie.category}
          </div>
        </div>

        {/* Themes (僅追蹤標籤) */}
        {movie.themes.length > 0 && (
          <div className="mt-auto pt-1 flex flex-wrap gap-1">
            {movie.themes.slice(0, 3).map(theme => (
              <span key={theme} className="text-[9px] font-medium text-white/40 bg-white/5 border border-white/5 rounded px-1.5 py-0.5">
                #{theme}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AvCard;
