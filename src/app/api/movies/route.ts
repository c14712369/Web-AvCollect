import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { insertMovie, listMovies, deleteMovie } from '@/lib/db/queries';
import { addMovieSchema } from '@/lib/validators';
import { extractTagsBySource } from '@/lib/scrape/detail-tags';

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': url,
      },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    let title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      'Unknown Title';
    let imageUrl = $('meta[property="og:image"]').attr('content') || '';

    let code = 'UNKNOWN';
    // 改良後的 Regex: 支援多個連字號 (如 FC2-PPV-xxxxxx) 且 URL 匹配也支援不分大小寫
    const codeRegex = /[a-z0-9]+(?:-[a-z0-9]+)+/i;
    const urlRegex = /\/([a-z0-9]+(?:-[a-z0-9]+)+)[\/\?]?/i;

    const titleMatch = title.match(codeRegex);
    const urlMatch = url.match(urlRegex);

    if (titleMatch) {
      code = titleMatch[0].toUpperCase();
    } else if (urlMatch) {
      code = urlMatch[1].toUpperCase();
    }

    if (!imageUrl) {
      if (source === 'Jable') {
        imageUrl = $('.video-img-box img').attr('src') || '';
      } else if (source === 'MissAV') {
        imageUrl = $('video').attr('poster') || '';
        // 如果還是沒抓到 (可能是被阻擋)，嘗試猜測 MissAV 的圖片路徑
        if (!imageUrl && code !== 'UNKNOWN') {
          imageUrl = `https://sixyik.com/${code.toLowerCase()}/cover-n.jpg`;
        }
      }
    }

    // 處理 Cloudflare "Just a moment..." 標題
    if (title.includes('Just a moment')) {
      title = code !== 'UNKNOWN' ? code : 'Scrape Failed (Cloudflare)';
    }

    // 詳情頁順手抽真實內容標籤（頁面已抓，幾乎零成本）
    let tags: string | null = null;
    const genres = extractTagsBySource(source, $);
    if (genres.length > 0) tags = JSON.stringify(genres);

    const movie = await insertMovie({
      code,
      title,
      url,
      imageUrl,
      source,
      category: '使用者新增',
      tags,
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
