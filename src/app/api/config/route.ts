import { NextResponse } from 'next/server';
import { getTagSettings, setConfigArray, setConfigObject } from '@/lib/db/queries';
import { getConfig, invalidateConfigCache } from '@/lib/config';
import { applyListDelta, type ListDelta } from '@/lib/config-patch';
import { configWriteSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...(await getTagSettings()) });
  } catch (error) {
    console.error('[GET /api/config]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/** 去除空白並去重（保序）。 */
const normalize = (arr: string[]): string[] =>
  Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

/** 將 prefix 統一轉大寫並去重。 */
const normalizePrefixes = (arr: string[]): string[] =>
  Array.from(new Set(arr.map((s) => s.trim().toUpperCase()).filter(Boolean)));

const normalizeDelta = (delta: ListDelta, norm: (arr: string[]) => string[]): ListDelta => ({
  add: norm(delta.add ?? []),
  remove: norm(delta.remove ?? []),
});

/** 以 DB 現況為底套用差異後寫回；移除項目寫進 log（守則③）。 */
const applyToConfig = async (
  key: string,
  current: string[],
  delta: ListDelta,
  norm: (arr: string[]) => string[]
): Promise<void> => {
  const d = normalizeDelta(delta, norm);
  const next = applyListDelta(current, d);
  const removed = current.filter((v) => !next.includes(v));
  if (removed.length) console.info(`[config] ${key} 移除 ${removed.length} 筆：${removed.join('、')}`);
  await setConfigArray(key, next);
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = configWriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { trackedTags, blockedTags, blockedIssuers, makerMap, preferredActresses } = parsed.data;
    // 讀取失敗會拋錯 → 500，絕不以空設定為底寫回
    const current = await getConfig();
    if (trackedTags) await applyToConfig('tracked_tags', current.trackedTags, trackedTags, normalize);
    if (blockedTags) await applyToConfig('blocked_tags', current.blockedTags, blockedTags, normalize);
    if (blockedIssuers) await applyToConfig('blocked_issuers', current.blockedIssuers, blockedIssuers, normalizePrefixes);
    if (preferredActresses) await applyToConfig('preferred_actresses', current.preferredActresses, preferredActresses, normalize);
    if (makerMap) {
      const upperKeyed: Record<string, string> = {};
      for (const [k, v] of Object.entries(makerMap)) upperKeyed[k.toUpperCase()] = v;
      await setConfigObject('maker_map', { ...current.makerMap, ...upperKeyed });
    }

    invalidateConfigCache();
    return NextResponse.json({ success: true, ...(await getTagSettings()) });
  } catch (error) {
    console.error('[POST /api/config]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
