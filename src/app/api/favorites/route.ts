import { NextResponse } from 'next/server';
import { addFavorite, listFavorites, removeFavorite, setFavorites } from '@/lib/db/queries';
import { favoritesWriteSchema } from '@/lib/validators';

export async function GET() {
  try {
    const codes = await listFavorites();
    return NextResponse.json(codes);
  } catch (error) {
    console.error('[GET /api/favorites]', error);
    // 不可回傳 []：前端會把它當成「使用者沒有收藏」，導致後續寫入洗掉整份收藏。
    return NextResponse.json({ success: false, error: 'Failed to load favorites' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = favoritesWriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // toggle 走單筆增刪，只有匯入的 replace 會覆蓋整份清單。
    const input = parsed.data;
    if (input.op === 'add') {
      await addFavorite(input.code);
    } else if (input.op === 'remove') {
      await removeFavorite(input.code);
    } else {
      await setFavorites(input.codes);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/favorites]', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
