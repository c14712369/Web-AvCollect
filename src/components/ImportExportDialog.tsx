'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Download, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useFavorites } from '@/hooks/useFavorites';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportExportDialog({ open, onClose }: Props) {
  const { favorites, replaceFavorites } = useFavorites();
  const [text, setText] = useState('');

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(favorites, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avcollect-favorites-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || !parsed.every((s) => typeof s === 'string')) {
        throw new Error('格式不正確：必須是字串陣列');
      }
      replaceFavorites(parsed);
      onClose();
      setText('');
    } catch (e) {
      window.alert('匯入失敗：' + (e as Error).message);
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
            <button onClick={onClose} className="absolute top-4 right-4 rounded-full p-1.5 text-white/60 hover:text-white transition-colors duration-200">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-white">收藏匯入 / 匯出</h3>
            <p className="mt-1 text-xs text-white/40">
              目前收藏 {favorites.length} 部影片
            </p>

            <button
              onClick={handleExport}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-500/40 px-5 py-2.5 text-sm font-bold text-indigo-300 hover:bg-indigo-500/30 transition-colors duration-200"
            >
              <Download className="h-4 w-4" />
              匯出為 JSON
            </button>

            <div className="mt-6">
              <label className="text-[10px] font-medium uppercase tracking-widest text-white/40">
                匯入：貼上 JSON 陣列
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='["SMCD-036", "AILB-010", ...]'
                rows={6}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
              />
              <button
                onClick={handleImport}
                disabled={!text.trim()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <Upload className="h-4 w-4" />
                覆蓋現有收藏並匯入
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
