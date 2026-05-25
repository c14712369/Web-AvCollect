import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTagSettings, setConfigArray } from '@/lib/db/queries';
import { invalidateConfigCache } from '@/lib/config';

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
const schema = z.object({
  trackedTags: tagArray.optional(),
  blockedTags: tagArray.optional(),
});

/** 去除空白並去重（保序）。 */
const normalize = (arr: string[]): string[] =>
  Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

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
    const { trackedTags, blockedTags } = parsed.data;
    if (trackedTags) await setConfigArray('tracked_tags', normalize(trackedTags));
    if (blockedTags) await setConfigArray('blocked_tags', normalize(blockedTags));

    invalidateConfigCache();
    return NextResponse.json({ success: true, ...(await getTagSettings()) });
  } catch (error) {
    console.error('[POST /api/config]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
