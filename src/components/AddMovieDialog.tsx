'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => Promise<void>;
  isSubmitting: boolean;
}

export function AddMovieDialog({ open, onClose, onSubmit, isSubmitting }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!url.trim()) {
      setError('請輸入網址');
      return;
    }
    try {
      await onSubmit(url.trim());
      setUrl('');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 rounded-full p-1.5 text-white/60 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-white">新增收藏</h3>
            <p className="mt-1 text-xs text-white/40">支援 Jable、MissAV、Javrate、SupJav 連結</p>

            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              placeholder="https://jable.tv/videos/..."
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isSubmitting ? '抓取中…' : '新增'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
