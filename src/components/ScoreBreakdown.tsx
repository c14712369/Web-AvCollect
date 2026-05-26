'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Target, Factory, Tag, Ban, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { Movie } from '@/types/av';
import { toIssuer } from '@/lib/taste/core';

interface ConfigSnapshot {
  blockedIssuers: string[];
  blockedTags: string[];
  trackedTags: string[];
  makerMap: Record<string, string>;
}

interface Props {
  movie: Movie;
}

export function ScoreBreakdown({ movie }: Props) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<ConfigSnapshot | null>(null);

  useEffect(() => {
    if (!open || cfg) return;
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setCfg({
            blockedIssuers: d.blockedIssuers ?? [],
            blockedTags: d.blockedTags ?? [],
            trackedTags: d.trackedTags ?? [],
            makerMap: d.makerMap ?? {},
          });
        }
      })
      .catch(() => {});
  }, [open, cfg]);

  if (!movie.matchBreakdown) return null;
  const b = movie.matchBreakdown;
  const issuer = toIssuer(movie.code);
  const isBlocked = cfg?.blockedIssuers.includes(issuer);
  const blockedTagHits = cfg
    ? movie.themes.filter((t) => cfg.blockedTags.includes(t))
    : [];

  return (
    <div className="mt-4 rounded-2xl border border-white/5 bg-black/20">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm text-white/70 transition-colors hover:text-white"
      >
        <span className="flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-300" /> 完整評分明細
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-white/5 px-4 py-3 text-sm">
              <Row icon={<Target className="h-3.5 w-3.5 text-pink-300" />} label="女優">
                {b.actress.hit ? (
                  <span>{b.actress.hit} <span className="text-white/40">(權重 {b.actress.weight.toFixed(1)})</span></span>
                ) : (
                  <span className="text-white/30">未命中</span>
                )}
                <Score value={b.actress.score} max={60} />
              </Row>
              <Row icon={<Factory className="h-3.5 w-3.5 text-sky-300" />} label="廠商">
                {b.issuer.hit ? (
                  <span>{b.issuer.hit} <span className="text-white/40">(權重 {b.issuer.weight.toFixed(1)})</span></span>
                ) : (
                  <span className="text-white/30">未命中</span>
                )}
                <Score value={b.issuer.score} max={25} />
              </Row>
              <Row icon={<Tag className="h-3.5 w-3.5 text-amber-300" />} label="標籤">
                {b.themes.hits.length > 0 ? (
                  <span>{b.themes.hits.join('、')}</span>
                ) : (
                  <span className="text-white/30">未命中</span>
                )}
                <Score value={b.themes.score} max={15} />
              </Row>

              <div className="mt-3 border-t border-white/5 pt-3 text-sm font-semibold">
                總分 {movie.matchScore ?? 0} → {tierLabel(movie.matchTier)}
              </div>

              {cfg && (
                <div className="mt-2 space-y-1 text-sm">
                  {isBlocked ? (
                    <div className="flex items-center gap-1.5 text-rose-300/90">
                      <Ban className="h-3.5 w-3.5" />
                      番號 {issuer} 在黑名單 — 新片應不會被推播
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-300/80">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      番號 {issuer} 不在黑名單
                    </div>
                  )}
                  {blockedTagHits.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-amber-300/90">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      命中封鎖標籤：{blockedTagHits.join('、')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-300/80">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      未命中任何封鎖標籤
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 text-white/60">{icon}{label}</div>
      <div className="flex flex-1 items-center justify-end gap-3 text-right text-white/85">
        {children}
      </div>
    </div>
  );
}

function Score({ value, max }: { value: number; max: number }) {
  return (
    <span className="ml-2 rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs text-white/70">
      +{value} / {max}
    </span>
  );
}

function tierLabel(tier?: string): string {
  if (tier === 'high') return '🎯 為你推薦';
  if (tier === 'medium') return '🤔 可能也喜歡';
  return '⬇️ 雜訊';
}

export default ScoreBreakdown;
