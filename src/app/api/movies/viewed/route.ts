import { NextResponse } from 'next/server';
import { recordMovieView, listViewedCodes } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const codes = await listViewedCodes();
    return NextResponse.json({ success: true, codes: Array.from(codes) });
  } catch (error) {
    console.error('[GET /api/movies/viewed]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = body?.code;
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing or invalid code' }, { status: 400 });
    }
    await recordMovieView(code);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/movies/viewed]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
