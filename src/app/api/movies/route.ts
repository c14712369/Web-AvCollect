import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { insertMovie, listMovies, deleteMovie } from '@/lib/db/queries';
import { addMovieSchema } from '@/lib/validators';
import { extractTagsBySource } from '@/lib/scrape/detail-tags';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
};

/** 解析標題（og:title 優先）。 */
function parseTitle($: cheerio.CheerioAPI): string {
  return (
    $('meta[property="og:title"]').attr('content') ||
    $('title').text() ||
    'Unknown Title'
  );
}

/** 是否被 Cloudflare / 反爬蟲攔截（403 或挑戰頁標題）。 */
function looksBlocked(status: number, title: string): boolean {
  return (
    status === 403 ||
    /Attention Required|Just a moment|you have been blocked|Enable JavaScript and cookies/i.test(title)
  );
}

/** 直連目標頁。 */
async function fetchDirect(url: string): Promise<{ html: string; status: number }> {
  const res = await fetch(url, {
    headers: { ...BROWSER_HEADERS, 'Cache-Control': 'no-cache', Pragma: 'no-cache', Referer: url },
  });
  return { html: await res.text(), status: res.status };
}

/**
 * 透過 Jina reader 代理抓取，繞過 Cloudflare 的 TLS 指紋封鎖。
 * Node fetch 的 TLS 指紋會被 CF 直接擋（403），代理端用瀏覽器方式抓回頁面。
 * 本機與 Vercel 皆可用。
 */
async function fetchViaJina(url: string): Promise<{ html: string; status: number }> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { ...BROWSER_HEADERS, 'X-Return-Format': 'html' },
  });
  return { html: await res.text(), status: res.status };
}

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
    else if (url.includes('supjav.com')) source = 'SupJav';

    let { html, status } = await fetchDirect(url);
    let $ = cheerio.load(html);
    let title = parseTitle($);

    // 直連被 Cloudflare 擋下 → 改走 Jina reader 代理重抓
    if (looksBlocked(status, title)) {
      ({ html, status } = await fetchViaJina(url));
      $ = cheerio.load(html);
      title = parseTitle($);
    }

    // 代理也失敗就回明確錯誤，別把「Attention Required! | Cloudflare」之類垃圾存進 DB
    if (looksBlocked(status, title)) {
      return NextResponse.json(
        {
          success: false,
          error: `${source} 受 Cloudflare 保護，連代理都抓不到，請稍後再試`,
        },
        { status: 502 }
      );
    }

    // 去掉標題尾端的站名後綴（如「… | Javrate」），同時讓女優名落在標題結尾以利擷取
    title = title.replace(/\s*[|｜]\s*(?:Javrate|Jable|MissAV|SupJav)\s*$/i, '').trim();

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
      } else if (source === 'SupJav') {
        // SupJav 無 og:image；詳情頁主圖在 .post-meta img.img（全尺寸）
        imageUrl = $('.post-meta img.img').attr('src') || '';
      }
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
