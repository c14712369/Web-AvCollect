'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Heart, ArrowRight, ImageOff, Trash2, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Movie } from '@/types/av';
import { useFavorites } from '@/hooks/useFavorites';
import { useDeleteMovie } from '@/hooks/useMovies';
import { upgradeImageUrl } from '@/lib/utils';
import { ACTRESS_SPLIT_REGEX } from '@/lib/actress-matcher';

interface Props {
  movie: Movie | null;
  onClose: () => void;
  onDeleteUpcoming?: (code: string) => void;
}

export function MovieDetailModal({ movie, onClose, onDeleteUpcoming }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { mutate: deleteMovie, isPending: isDeleting } = useDeleteMovie();

  const handleDelete = () => {
    if (!movie) return;
    // 預售新片走專用刪除流程
    if (movie.category === '預售新片' && onDeleteUpcoming) {
      if (window.confirm('確定要刪除這部預售新片嗎？')) {
        onDeleteUpcoming(movie.code);
        onClose();
      }
      return;
    }
    if (window.confirm('確定要刪除這部影片嗎？')) {
      deleteMovie(movie.code, { onSuccess: onClose });
    }
  };

  const handleWatch = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // 若使用者按住 Ctrl (Windows) 或 Cmd (Mac)，直接讓瀏覽器以原生背景分頁開啟，只關閉 Modal
    if (e.ctrlKey || e.metaKey) {
      onClose();
      return;
    }

    if (!movie?.url) return;

    // 派發事件給擴充功能或油猴腳本
    window.dispatchEvent(
      new CustomEvent('avcollect:open-background-tab', {
        detail: { url: movie.url },
      })
    );

    // 立即關閉 Modal
    onClose();

    // 若瀏覽器已安裝擴充功能，擴充功能已在背景靜默開好，阻止預設跳轉
    if (typeof window !== 'undefined' && (window as any).__AVCOLLECT_EXT_INSTALLED__) {
      e.preventDefault();
      return;
    }

    // 無擴充功能時的常規 fallback 開啟
    e.preventDefault();
    window.open(movie.url, '_blank');
  };

  const handleAuxClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // 滑鼠滾輪中鍵點擊 (button === 1)
    if (e.button === 1) {
      onClose();
      setTimeout(() => {
        window.focus();
      }, 50);
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
    const onCloseEvent = () => onClose();

    document.addEventListener('keydown', onKey);
    window.addEventListener('avcollect:close-modal', onCloseEvent);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('avcollect:close-modal', onCloseEvent);
    };
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
                  className={movie.category === '預售新片' ? "object-contain" : "object-cover"}
                  sizes="(max-width: 768px) 100vw, 672px"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent pointer-events-none" />
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded bg-indigo-500/20 px-2 py-1 text-xs font-black tracking-tighter text-indigo-300 border border-indigo-500/30">
                    {movie.code}
                  </span>
                  {movie.actress && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {movie.actress
                        .split(ACTRESS_SPLIT_REGEX)
                        .map((a) => a.trim())
                        .filter(Boolean)
                        .map((actressName) => (
                          <Link
                            key={actressName}
                            href={`/actress/${encodeURIComponent(actressName)}`}
                            onClick={onClose}
                            className="group inline-flex items-center gap-1.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 hover:border-rose-500/50 px-2.5 py-1 text-xs font-bold text-rose-300 hover:text-rose-200 transition-all active:scale-95 shadow-sm"
                            title={`查看 ${actressName} 的所有作品`}
                          >
                            <User className="h-3.5 w-3.5 text-rose-400" />
                            <span>{actressName}</span>
                            <ArrowRight className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
                {/* 預售新片時隱藏收藏按鈕 */}
                {movie.category !== '預售新片' && (
                  <button
                    onClick={() => toggleFavorite(movie.code)}
                    className="rounded-full bg-white/5 p-2 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <Heart
                      className={`h-4 w-4 ${isFavorite(movie.code) ? 'fill-red-500 text-red-500' : 'text-white/60'}`}
                    />
                  </button>
                )}
              </div>
              
              <h2 className="text-lg font-bold leading-snug text-white">{movie.title}</h2>

              {/* 操作按鈕 - 放在標題下方 */}
              <div className="flex gap-2.5 pt-1">
                <a
                  href={movie.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-action="watch-external"
                  onClick={handleWatch}
                  onAuxClick={handleAuxClick}
                  title="左鍵點擊前往；亦支援滑鼠中鍵或 Ctrl+點擊在背景開片"
                  className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-500/50 active:scale-95 cursor-pointer select-none"
                >
                  <ExternalLink className="h-4 w-4" />
                  {movie.category === '預售新片' ? '前往官網' : '前往觀看'}
                </a>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3.5 text-sm font-bold text-rose-500 transition hover:bg-rose-500/20 disabled:opacity-50 border border-rose-500/20 active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? '...' : '刪除'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
