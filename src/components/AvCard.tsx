'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ExternalLink, Heart } from 'lucide-react';
import { Movie } from '@/types/av';
import { useFavorites } from '@/hooks/useFavorites';

interface AvCardProps {
  movie: Movie;
}

export const AvCard: React.FC<AvCardProps> = ({ movie }) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(movie.code);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(movie.code);
  };

  const [imgSrc, setImgSrc] = React.useState(movie.imageUrl.replace('cover-t.jpg', 'cover-n.jpg'));

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] cursor-pointer"
      onClick={() => window.open(movie.url, '_blank')}
    >
      {/* Image Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
        <Image
          src={imgSrc}
          alt={movie.title}
          fill
          unoptimized={true}
          referrerPolicy="no-referrer"
          onError={() => {
            if (imgSrc.includes('cover-n.jpg')) {
              setImgSrc(movie.imageUrl); // fallback to original (cover-t.jpg)
            }
          }}
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 20vw, 10vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-40" />
        
        {/* Favorite Button */}
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleFavoriteClick}
          className="absolute top-1.5 left-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/5 transition-colors hover:bg-black/60"
        >
          <Heart 
            className={`h-3 w-3 transition-colors ${favorited ? 'fill-red-500 text-red-500' : 'text-white/70'}`} 
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
          <div className="rounded bg-indigo-500/30 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-indigo-200 border border-indigo-500/30 uppercase">
            {movie.maker}
          </div>
          <div className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-rose-300 border border-rose-500/20 truncate max-w-[80px]">
            {movie.category === 'ActressMatched' ? '追蹤女優' : 
             movie.category === 'TagMatched' ? '追蹤標籤' : 
             movie.category === 'DailyHot' ? '日熱門' : 
             movie.category === 'WeeklyHot' ? '週熱門' : 
             movie.category === 'New' ? '最新' : movie.category}
          </div>
        </div>
        
        {/* Themes */}
        <div className="mt-auto pt-1 flex flex-wrap gap-1">
          {movie.themes.slice(0, 3).map(theme => (
            <span key={theme} className="text-[9px] font-medium text-white/40 bg-white/5 border border-white/5 rounded px-1.5 py-0.5">
              #{theme}
            </span>
          ))}
          {movie.themes.length === 0 && (
             <span className="text-[9px] font-medium text-white/20 px-1.5 py-0.5">無特定主題</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvCard;
