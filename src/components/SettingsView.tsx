'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, X, Tag, Ban, Sparkles, Loader2, Check, Save, RefreshCw, Star } from 'lucide-react';
import type { TagSettings } from '@/lib/db/queries';
import { MakerPrefixManager } from './MakerPrefixManager';

interface Props {
  initial: TagSettings;
}

export function SettingsView({ initial }: Props) {
  const [tracked, setTracked] = useState<string[]>(initial.trackedTags);
  const [blocked, setBlocked] = useState<string[]>(initial.blockedTags);
  const [preferredActresses, setPreferredActresses] = useState<string[]>(initial.preferredActresses);
  const [suggestions, setSuggestions] = useState<string[]>(initial.suggestions);
  const [blockedSuggestions, setBlockedSuggestions] = useState<string[]>(initial.blockedSuggestions);
  const [actressSuggestions, setActressSuggestions] = useState<string[]>(initial.actressSuggestions);
  const [makerMap, setMakerMap] = useState<Record<string, string>>(initial.makerMap);
  const [blockedIssuers, setBlockedIssuers] = useState<string[]>(initial.blockedIssuers);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState('');

  const dirty = useMemo(
    () =>
      JSON.stringify(tracked) !== JSON.stringify(initial.trackedTags) ||
      JSON.stringify(blocked) !== JSON.stringify(initial.blockedTags) ||
      JSON.stringify(preferredActresses) !== JSON.stringify(initial.preferredActresses),
    [tracked, blocked, preferredActresses, initial]
  );

  const addTo = (list: string[], set: (v: string[]) => void, raw: string) => {
    const v = raw.trim();
    if (!v || list.includes(v)) return;
    set([...list, v]);
    setSuggestions((s) => s.filter((x) => x !== v));
    setBlockedSuggestions((s) => s.filter((x) => x !== v));
    setActressSuggestions((s) => s.filter((x) => x !== v));
  };
  const removeFrom = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.filter((x) => x !== v));

  // Prefix 持久化：debounce + abort，避免連點 race。
  // 收到 success 後 *不再* 覆寫 UI state，因為樂觀更新已經是 user intent；
  // 失敗才從 server fetch 真實狀態同步。
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<{ blockedIssuers?: string[]; makerMap?: Record<string, string> }>({});
  const abortRef = useRef<AbortController | null>(null);

  const flushPersist = async () => {
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (!patch.blockedIssuers && !patch.makerMap) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!data.success) throw new Error(typeof data.error === 'string' ? data.error : '儲存失敗');
      setError('');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      // 失敗：拉真實狀態回來、別猜
      try {
        const r = await fetch('/api/config');
        const d = await r.json();
        if (d?.success) {
          setBlockedIssuers(d.blockedIssuers ?? []);
          setMakerMap(d.makerMap ?? {});
        }
      } catch {}
      setError((e as Error).message);
    }
  };

  const persistPrefix = (patch: { blockedIssuers?: string[]; makerMap?: Record<string, string> }) => {
    if (patch.blockedIssuers) setBlockedIssuers(patch.blockedIssuers);
    if (patch.makerMap) setMakerMap((prev) => ({ ...prev, ...patch.makerMap }));

    if (patch.blockedIssuers) pendingPatchRef.current.blockedIssuers = patch.blockedIssuers;
    if (patch.makerMap) {
      pendingPatchRef.current.makerMap = {
        ...(pendingPatchRef.current.makerMap ?? {}),
        ...patch.makerMap,
      };
    }

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(flushPersist, 350);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedTags: tracked, blockedTags: blocked, preferredActresses }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(typeof data.error === 'string' ? data.error : '儲存失敗');
      setTracked(data.trackedTags);
      setBlocked(data.blockedTags);
      setPreferredActresses(data.preferredActresses);
      setSuggestions(data.suggestions);
      setBlockedSuggestions(data.blockedSuggestions);
      setActressSuggestions(data.actressSuggestions);
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
            <h1 className="text-xl font-bold tracking-tight leading-none">偏好設定</h1>
            <p className="mt-0.5 text-sm text-white/40">維護追蹤標籤、黑名單與喜愛女優，調校你的推薦口味</p>
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

        {blockedSuggestions.length > 0 && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-rose-300" />
              你「沒收藏」的片常見標籤
              <span className="font-normal text-white/35">點一下加入黑名單</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {blockedSuggestions.map((s) => (
                <button
                  key={`block-sug-${s}`}
                  onClick={() => addTo(blocked, setBlocked, s)}
                  className="group flex items-center gap-1 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-100/90 transition-all hover:border-rose-400/40 hover:bg-rose-500/20"
                >
                  <Plus className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <TagEditor
          icon={<Star className="h-4 w-4 text-pink-300" />}
          title="喜愛女優名單"
          hint="清單內的女優作品會大幅加分（直接列為高契合），並可在首頁用「喜愛女優」一鍵篩選"
          accent="pink"
          tags={preferredActresses}
          onAdd={(v) => addTo(preferredActresses, setPreferredActresses, v)}
          onRemove={(v) => removeFrom(preferredActresses, setPreferredActresses, v)}
          placeholder="輸入女優名後按 Enter…"
        />

        {actressSuggestions.length > 0 && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-pink-300" />
              你收藏裡常出現的女優
              <span className="font-normal text-white/35">點一下加入喜愛名單</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {actressSuggestions.map((s) => (
                <button
                  key={`actress-sug-${s}`}
                  onClick={() => addTo(preferredActresses, setPreferredActresses, s)}
                  className="group flex items-center gap-1 rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1.5 text-sm text-pink-100/90 transition-all hover:border-pink-400/40 hover:bg-pink-500/20"
                >
                  <Plus className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <MakerPrefixManager
          makerMap={makerMap}
          blockedIssuers={blockedIssuers}
          onChange={persistPrefix}
        />

        <BackfillCard />
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
              <span className="text-white/30">追蹤 {tracked.length}・黑名單 {blocked.length}・女優 {preferredActresses.length}</span>
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

function BackfillCard() {
  const [latest, setLatest] = useState<{ status: string; conclusion: string | null; createdAt: string; url: string } | null>(null);
  const [workflowUrl, setWorkflowUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchedAt, setDispatchedAt] = useState(0);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backfill');
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? '查詢失敗');
      setLatest(data.latestRun);
      setWorkflowUrl(data.workflowUrl);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const dispatch = async () => {
    setDispatching(true);
    setError('');
    try {
      const res = await fetch('/api/admin/backfill', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? '觸發失敗');
      setDispatchedAt(Date.now());
      setTimeout(refresh, 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <div className="mb-1 flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-emerald-300" />
        <h2 className="text-base font-semibold">維護工具</h2>
      </div>
      <p className="mb-4 text-sm text-white/40">
        舊片標籤回補：對 tags 為空的舊片從詳情頁補抓真實標籤
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={dispatch}
          disabled={dispatching}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:shadow-emerald-500/40 active:scale-95 disabled:opacity-40"
        >
          {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          觸發背景補抓
        </button>
        {workflowUrl && (
          <a
            href={workflowUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            前往 GHA 查看進度
          </a>
        )}
      </div>

      <div className="mt-3 text-sm">
        {error && <span className="text-rose-400">{error}</span>}
        {dispatchedAt > 0 && !error && (
          <span className="text-emerald-300/80">已觸發 — GHA 約幾秒後出現在列表</span>
        )}
        {!error && latest && (
          <div className="mt-2 text-white/40">
            最近一次：{new Date(latest.createdAt).toLocaleString('zh-TW')} —{' '}
            {latest.status === 'completed' ? latest.conclusion ?? 'completed' : latest.status}
            {' · '}
            <a href={latest.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
              查看 run
            </a>
          </div>
        )}
        {!error && !latest && !loading && <span className="text-white/30">尚無 run 紀錄</span>}
      </div>
    </section>
  );
}

interface EditorProps {
  icon: React.ReactNode;
  title: string;
  hint: string;
  accent: 'violet' | 'rose' | 'pink';
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
}

function TagEditor({ icon, title, hint, accent, tags, onAdd, onRemove, placeholder }: EditorProps) {
  const [input, setInput] = useState('');
  const chip =
    accent === 'violet'
      ? 'border-violet-400/25 bg-violet-500/15 text-violet-100'
      : accent === 'pink'
        ? 'border-pink-400/25 bg-pink-500/15 text-pink-100'
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
          placeholder={placeholder ?? '輸入標籤後按 Enter…'}
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
