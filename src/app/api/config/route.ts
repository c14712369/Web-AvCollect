import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTagSettings, setConfigArray, setConfigObject } from '@/lib/db/queries';
import { getConfig, invalidateConfigCache } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...(await getTagSettings()) });
  } catch (error) {
    console.error('[GET /api/config]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

const tagArray = z.array(z.string().trim().min(1).max(30)).max(300);
const prefixArray = z.array(
  z.string().trim().min(1).max(20).regex(/^[A-Z0-9]+$/i)
).max(500);
const makerMapPatch = z.record(
  z.string().trim().min(1).max(20).regex(/^[A-Z0-9]+$/i),
  z.string().trim().min(1).max(40)
);

const actressArray = z.array(z.string().trim().min(1).max(40)).max(500);

const schema = z.object({
  trackedTags: tagArray.optional(),
  blockedTags: tagArray.optional(),
  blockedIssuers: prefixArray.optional(),
  makerMap: makerMapPatch.optional(),
  preferredActresses: actressArray.optional(),
});

/** 去除空白並去重（保序）。 */
const normalize = (arr: string[]): string[] =>
  Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

/** 將 prefix 統一轉大寫並去重。 */
const normalizePrefixes = (arr: string[]): string[] =>
  Array.from(new Set(arr.map((s) => s.trim().toUpperCase()).filter(Boolean)));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { trackedTags, blockedTags, blockedIssuers, makerMap, preferredActresses } = parsed.data;
    if (trackedTags) await setConfigArray('tracked_tags', normalize(trackedTags));
    if (blockedTags) await setConfigArray('blocked_tags', normalize(blockedTags));
    if (blockedIssuers) await setConfigArray('blocked_issuers', normalizePrefixes(blockedIssuers));
    if (preferredActresses) await setConfigArray('preferred_actresses', normalize(preferredActresses));
    if (makerMap) {
      const current = (await getConfig()).makerMap;
      const upperKeyed: Record<string, string> = {};
      for (const [k, v] of Object.entries(makerMap)) upperKeyed[k.toUpperCase()] = v;
      await setConfigObject('maker_map', { ...current, ...upperKeyed });
    }

    invalidateConfigCache();
    return NextResponse.json({ success: true, ...(await getTagSettings()) });
  } catch (error) {
    console.error('[POST /api/config]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
