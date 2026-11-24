import { NextResponse } from 'next/server';
import { listTrashedMovies, restoreTrashedMovie, TRASH_RETENTION_DAYS } from '@/lib/db/movie-trash';
import { restoreTrashSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/** 回收桶清單；讀取失敗回 5xx，不回空清單。 */
export async function GET() {
  try {
    const items = await listTrashedMovies();
    return NextResponse.json({ success: true, items, retentionDays: TRASH_RETENTION_DAYS });
  } catch (error) {
    console.error('[GET /api/movies/trash]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/** 還原單一部片：{ code } */
export async function POST(req: Request) {
  const parsed = restoreTrashSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? '格式錯誤' }, { status: 400 });
  }
  try {
    const restored = await restoreTrashedMovie(parsed.data.code);
    if (!restored) {
      return NextResponse.json({ success: false, error: '回收桶裡找不到這部片' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/movies/trash]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
