'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Heart, ArrowRight, ImageOff, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Movie } from '@/types/av';
import { useFavorites } from '@/hooks/useFavorites';
import { useDeleteMovie } from '@/hooks/useMovies';
import { upgradeImageUrl } from '@/lib/utils';

interface Props {
  movie: Movie | null;
  onClose: () => void;
}

export function MovieDetailModal({ movie, onClose }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { mutate: deleteMovie, isPending: isDeleting } = useDeleteMovie();

  const handleDelete = () => {
    if (window.confirm('\u78BA\u5B9A\u8981\u522A\u9664\u9019\u90E8\u5F71\u7247\u55CE\uFF1F')) {
      if (movie) deleteMovie(movie.code, { onSuccess: onClose });
    }
  };

  const initialUrl = movie ? upgradeImageUrl(movie.imageUrl, movie.source) : '';
  const [imgSrc, setImgSrc] = useState(initialUrl);
  const [imgError, setImgError] = useState(false);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    if (movie) {
      setImgSrc(upgradeImageUrl(movie.imageUrl, movie.source));
      setImgError(!movie.imageUrl);
      setRetried(false);
    }
  }, [movie]);

  const handleImgError = () => {
    if (!retried && movie && imgSrc !== movie.imageUrl && movie.imageUrl) {
      setRetried(true);
      setImgSrc(movie.imageUrl);
    } else {
      setImgError(true);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {movie && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-3xl custom-scrollbar border border-white/10 bg-zinc-950/95 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/40 p-2 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative aspect-[16/10] w-full bg-zinc-900">
              {imgError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900/40 via-zinc-900 to-violet-900/30 p-8">
                  <ImageOff className="h-10 w-10 text-white/20 mb-4" />
                  <div className="text-sm font-mono font-bold text-indigo-300/70 tracking-wider">
                    {movie.code}
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
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 672px"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent pointer-events-none" />
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex rounded bg-indigo-500/20 px-2 py-1 text-xs font-black tracking-tighter text-indigo-300 border border-indigo-500/30">
                  {movie.code}
                </span>
                <button
                  onClick={() => toggleFavorite(movie.code)}
                  className="rounded-full bg-white/5 p-2 border border-white/10 hover:bg-white/10"
                >
                  <Heart
                    className={`h-4 w-4 ${isFavorite(movie.code) ? 'fill-red-500 text-red-500' : 'text-white/60'}`}
                  />
                </button>
              </div>
              <h2 className="text-lg font-bold leading-snug text-white">{movie.title}</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field label="來源" value={movie.source} />
                <Field label="廠商" value={movie.maker || '—'} />
                <Field label="分類" value={movie.category} />
                <Field label="發行日" value={movie.releaseDate ?? '—'} />
                {movie.actress ? (
                  <Link
                    href={`/actress/${encodeURIComponent(movie.actress)}`}
                    onClick={onClose}
                    className="group flex flex-col rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-white/5"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">女優</p>
                    <span className="flex items-center gap-1 mt-0.5 text-sm font-semibold text-rose-300 group-hover:text-rose-200">
                      {movie.actress}
                      <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </span>
                  </Link>
                ) : (
                  <Field label="女優" value="—" />
                )}
              </div>
              {movie.themes.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-white/40 mb-2">主題</p>
                  <div className="flex flex-wrap gap-1.5">
                    {movie.themes.map((t) => (
                      <span key={t} className="text-xs text-white/70 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <a
                href={movie.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-500/50"
              >
                <ExternalLink className="h-4 w-4" />
                前往觀看
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">{label}</p>
      <p className="text-sm text-white/90 mt-0.5">{value}</p>
    </div>
  );
}
