import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { upcomingMovies } from '@/lib/db/schema';
import { asc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(upcomingMovies)
      .orderBy(
        sql`case when ${upcomingMovies.releaseDate} is null then 1 else 0 end`,
        asc(upcomingMovies.releaseDate)
      );
    return NextResponse.json({ success: true, movies: rows });
  } catch (error) {
    console.error('[GET /api/upcoming]', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Missing code' },
        { status: 400 }
      );
    }
    await db.delete(upcomingMovies).where(eq(upcomingMovies.code, code));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/upcoming]', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
