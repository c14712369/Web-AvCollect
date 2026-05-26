'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, X, Tag, Ban, Sparkles, Loader2, Check, Save } from 'lucide-react';
import type { TagSettings } from '@/lib/db/queries';
import { MakerPrefixManager } from './MakerPrefixManager';

interface Props {
  initial: TagSettings;
}

export function SettingsView({ initial }: Props) {
  const [tracked, setTracked] = useState<string[]>(initial.trackedTags);
  const [blocked, setBlocked] = useState<string[]>(initial.blockedTags);
  const [suggestions, setSuggestions] = useState<string[]>(initial.suggestions);
  const [makerMap, setMakerMap] = useState<Record<string, string>>(initial.makerMap);
  const [blockedIssuers, setBlockedIssuers] = useState<string[]>(initial.blockedIssuers);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState('');

  const dirty = useMemo(
    () =>
      JSON.stringify(tracked) !== JSON.stringify(initial.trackedTags) ||
      JSON.stringify(blocked) !== JSON.stringify(initial.blockedTags),
    [tracked, blocked, initial]
  );

  const addTo = (list: string[], set: (v: string[]) => void, raw: string) => {
    const v = raw.trim();
    if (!v || list.includes(v)) return;
    set([...list, v]);
    setSuggestions((s) => s.filter((x) => x !== v));
  };
  const removeFrom = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.filter((x) => x !== v));

  const persistPrefix = async (patch: { blockedIssuers?: string[]; makerMap?: Record<string, string> }) => {
    if (patch.blockedIssuers) setBlockedIssuers(patch.blockedIssuers);
    if (patch.makerMap) setMakerMap((prev) => ({ ...prev, ...patch.makerMap }));
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.success) throw new Error(typeof data.error === 'string' ? data.error : '儲存失敗');
      setBlockedIssuers(data.blockedIssuers);
      setMakerMap(data.makerMap);
      setError('');
    } catch (e) {
      setBlockedIssuers(initial.blockedIssuers);
      setMakerMap(initial.makerMap);
      setError((e as Error).message);
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedTags: tracked, blockedTags: blocked }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(typeof data.error === 'string' ? data.error : '儲存失敗');
      setTracked(data.trackedTags);
      setBlocked(data.blockedTags);
      setSuggestions(data.suggestions);
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white font-inter selection:bg-indigo-500/30">
      <header className="sticky top-0 z-50 w-full border-b border-white/5 glass">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 glass text-white/60 transition-all hover:text-white hover:border-white/20"
            aria-label="返回"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-none">標籤偏好設定</h1>
            <p className="mt-0.5 text-sm text-white/40">維護追蹤與黑名單標籤，調校你的推薦口味</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
        <TagEditor
          icon={<Tag className="h-4 w-4 text-violet-300" />}
          title="追蹤標籤"
          hint="符合的片會加分；熱門榜命中也更容易被推薦"
          accent="violet"
          tags={tracked}
          onAdd={(v) => addTo(tracked, setTracked, v)}
          onRemove={(v) => removeFrom(tracked, setTracked, v)}
        />

        {suggestions.length > 0 && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              來自你收藏的常見標籤
              <span className="font-normal text-white/35">點一下加入追蹤</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => addTo(tracked, setTracked, s)}
                  className="group flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100/90 transition-all hover:border-amber-400/40 hover:bg-amber-500/20"
                >
                  <Plus className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <TagEditor
          icon={<Ban className="h-4 w-4 text-rose-300" />}
          title="黑名單標籤"
          hint="命中就排除（但若同時是追蹤女優則保留）"
          accent="rose"
          tags={blocked}
          onAdd={(v) => addTo(blocked, setBlocked, v)}
          onRemove={(v) => removeFrom(blocked, setBlocked, v)}
        />

        <MakerPrefixManager
          makerMap={makerMap}
          blockedIssuers={blockedIssuers}
          onChange={persistPrefix}
        />
      </div>

      {/* 儲存列 */}
      <div className="sticky bottom-0 z-40 border-t border-white/5 glass">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-h-[20px] text-sm">
            {error ? (
              <span className="text-rose-400">{error}</span>
            ) : savedAt && !dirty ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Check className="h-4 w-4" /> 已儲存
              </span>
            ) : dirty ? (
              <span className="text-white/40">有未儲存的變更</span>
            ) : (
              <span className="text-white/30">追蹤 {tracked.length}・黑名單 {blocked.length}</span>
            )}
          </div>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-indigo-500/50 active:scale-95 disabled:opacity-40 disabled:shadow-none"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            儲存變更
          </button>
        </div>
      </div>
    </main>
  );
}

interface EditorProps {
  icon: React.ReactNode;
  title: string;
  hint: string;
  accent: 'violet' | 'rose';
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}

function TagEditor({ icon, title, hint, accent, tags, onAdd, onRemove }: EditorProps) {
  const [input, setInput] = useState('');
  const chip =
    accent === 'violet'
      ? 'border-violet-400/25 bg-violet-500/15 text-violet-100'
      : 'border-rose-400/25 bg-rose-500/15 text-rose-100';

  const submit = () => {
    onAdd(input);
    setInput('');
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-sm font-mono text-white/50">
          {tags.length}
        </span>
      </div>
      <p className="mb-4 text-sm text-white/40">{hint}</p>

      <div className="mb-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="輸入標籤後按 Enter…"
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none transition-all focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/30"
        />
        <button
          onClick={submit}
          className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white active:scale-95"
        >
          <Plus className="h-4 w-4" /> 新增
        </button>
      </div>

      {tags.length === 0 ? (
        <p className="py-2 text-sm text-white/25">尚無標籤</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {tags.map((t) => (
              <motion.span
                key={t}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${chip}`}
              >
                {t}
                <button
                  onClick={() => onRemove(t)}
                  className="rounded-full p-0.5 opacity-50 transition-opacity hover:bg-white/20 hover:opacity-100"
                  aria-label={`移除 ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

export default SettingsView;
