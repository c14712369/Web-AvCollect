'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Factory, Plus, RotateCcw, CheckCheck } from 'lucide-react';

interface Props {
  makerMap: Record<string, string>;
  blockedIssuers: string[];
  onChange: (patch: { blockedIssuers?: string[]; makerMap?: Record<string, string> }) => void;
}

interface NewPrefixForm {
  prefix: string;
  maker: string;
}

/** 把 maker_map 反轉為 { maker → prefixes[] }，並按字母排序。 */
function groupByMaker(map: Record<string, string>): Array<[string, string[]]> {
  const out: Record<string, string[]> = {};
  for (const [prefix, maker] of Object.entries(map)) {
    const key = maker || '(未分類)';
    (out[key] ??= []).push(prefix.toUpperCase());
  }
  for (const list of Object.values(out)) list.sort();
  return Object.entries(out).sort(([a], [b]) => {
    if (a === '(未分類)') return 1;
    if (b === '(未分類)') return -1;
    return a.localeCompare(b);
  });
}

export function MakerPrefixManager({ makerMap, blockedIssuers, onChange }: Props) {
  const blocked = useMemo(() => new Set(blockedIssuers.map((p) => p.toUpperCase())), [blockedIssuers]);
  const groups = useMemo(() => groupByMaker(makerMap), [makerMap]);
  const knownMakers = useMemo(
    () => Array.from(new Set(Object.values(makerMap))).sort(),
    [makerMap]
  );
  const [form, setForm] = useState<NewPrefixForm>({ prefix: '', maker: '' });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (prefix: string) => {
    const next = new Set(blocked);
    if (next.has(prefix)) next.delete(prefix);
    else next.add(prefix);
    onChange({ blockedIssuers: Array.from(next).sort() });
  };

  const setAll = (prefixes: string[], block: boolean) => {
    const next = new Set(blocked);
    for (const p of prefixes) {
      if (block) next.add(p);
      else next.delete(p);
    }
    onChange({ blockedIssuers: Array.from(next).sort() });
  };

  const addPrefix = () => {
    const prefix = form.prefix.trim().toUpperCase();
    const maker = form.maker.trim();
    if (!prefix || !maker) return;
    if (!/^[A-Z0-9]+$/.test(prefix)) return;
    onChange({ makerMap: { [prefix]: maker } });
    setForm({ prefix: '', maker: '' });
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <div className="mb-1 flex items-center gap-2">
        <Factory className="h-4 w-4 text-sky-300" />
        <h2 className="text-base font-semibold">廠商與番號</h2>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-sm font-mono text-white/50">
          {Object.keys(makerMap).length}
        </span>
      </div>
      <p className="mb-4 text-sm text-white/40">
        勾選的 prefix 會被追蹤；取消勾選 = 加入硬閘門黑名單，新片不爬不推
      </p>

      <div className="space-y-3">
        {groups.map(([maker, prefixes]) => {
          const allBlocked = prefixes.every((p) => blocked.has(p));
          const noneBlocked = prefixes.every((p) => !blocked.has(p));
          const isExpanded = expanded[maker] ?? prefixes.length <= 8;
          const visiblePrefixes = isExpanded ? prefixes : prefixes.slice(0, 8);
          return (
            <div key={maker} className="rounded-xl border border-white/5 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white/85">{maker}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAll(prefixes, false)}
                    disabled={noneBlocked}
                    className="flex items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200/80 transition-all hover:bg-emerald-500/20 disabled:opacity-30"
                  >
                    <CheckCheck className="h-3 w-3" /> 全選
                  </button>
                  <button
                    onClick={() => setAll(prefixes, true)}
                    disabled={allBlocked}
                    className="flex items-center gap-1 rounded-md border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200/80 transition-all hover:bg-rose-500/20 disabled:opacity-30"
                  >
                    <RotateCcw className="h-3 w-3" /> 全清
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <AnimatePresence initial={false}>
                  {visiblePrefixes.map((p) => {
                    const isBlocked = blocked.has(p);
                    return (
                      <motion.button
                        key={p}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        onClick={() => toggle(p)}
                        className={
                          isBlocked
                            ? 'rounded-full border border-white/5 bg-zinc-800/50 px-3 py-1 text-sm text-zinc-500 line-through transition-all hover:bg-zinc-800/80'
                            : 'rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-1 text-sm text-violet-100 transition-all hover:bg-violet-500/30'
                        }
                      >
                        {p}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
                {!isExpanded && (
                  <button
                    onClick={() => setExpanded({ ...expanded, [maker]: true })}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/60 hover:bg-white/10"
                  >
                    +{prefixes.length - 8} 更多
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-black/20 p-3">
        <input
          value={form.prefix}
          onChange={(e) => setForm({ ...form, prefix: e.target.value })}
          placeholder="新 prefix (例 ABCD)"
          className="flex-1 min-w-[120px] rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm uppercase text-white placeholder:text-white/25 outline-none focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/30"
        />
        <input
          list="known-makers"
          value={form.maker}
          onChange={(e) => setForm({ ...form, maker: e.target.value })}
          placeholder="廠商名"
          className="flex-1 min-w-[120px] rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white placeholder:text-white/25 outline-none focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/30"
        />
        <datalist id="known-makers">
          {knownMakers.map((m) => <option key={m} value={m} />)}
        </datalist>
        <button
          onClick={addPrefix}
          disabled={!form.prefix.trim() || !form.maker.trim()}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-indigo-500/40 active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          <Plus className="h-3.5 w-3.5" /> 加入
        </button>
      </div>
    </section>
  );
}

export default MakerPrefixManager;
