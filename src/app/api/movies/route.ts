import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { insertMovie, listMovies, deleteMovie } from '@/lib/db/queries';
import { addMovieSchema } from '@/lib/validators';

export async function GET() {
  try {
    const movies = await listMovies();
    return NextResponse.json({ success: true, movies });
  } catch (error) {
    console.error('[GET /api/movies]', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = addMovieSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { url } = parsed.data;

    let source = 'Unknown';
    if (url.includes('jable.tv')) source = 'Jable';
    else if (url.includes('missav')) source = 'MissAV';
    else if (url.includes('javrate.com')) source = 'Javrate';

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      'Unknown Title';
    let imageUrl = $('meta[property="og:image"]').attr('content') || '';

    if (!imageUrl) {
      if (source === 'Jable') {
        imageUrl = $('.video-img-box img').attr('src') || '';
      } else if (source === 'MissAV') {
        imageUrl = $('video').attr('poster') || '';
      }
    }

    let code = 'UNKNOWN';
    const codeMatch =
      title.match(/[A-Z0-9]+-[0-9A-Z]+/i) ||
      url.match(/\/([a-zA-Z0-9]+-[0-9A-Z]+)[\/\?]?/);
    if (codeMatch) {
      code = codeMatch[1].toUpperCase();
    }

    const movie = await insertMovie({
      code,
      title,
      url,
      imageUrl,
      source,
      category: 'User Added',
    });

    if (!movie) {
      return NextResponse.json({
        success: false,
        error: '番號已存在',
      }, { status: 409 });
    }

    return NextResponse.json({ success: true, movie });
  } catch (error) {
    console.error('[POST /api/movies]', error);
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
    if (!code) return NextResponse.json({ success: false, error: 'Missing code' }, { status: 400 });
    await deleteMovie(code);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/movies]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
