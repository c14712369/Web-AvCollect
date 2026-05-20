import { NextResponse } from 'next/server';
import { listFavorites, setFavorites } from '@/lib/db/queries';
import { favoritesSchema } from '@/lib/validators';

export async function GET() {
  try {
    const codes = await listFavorites();
    return NextResponse.json(codes);
  } catch (error) {
    console.error('[GET /api/favorites]', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = favoritesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await setFavorites(parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/favorites]', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
