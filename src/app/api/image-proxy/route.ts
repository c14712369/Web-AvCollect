import { NextResponse } from 'next/server';

// 僅允許從這些網域代理圖片，避免 SSRF（探測內網 / 雲端 metadata）
const ALLOWED_HOSTS = [
  'sixyik.com',
  'cdn.jable.tv',
  'jable.tv',
  'missav.com',
  'fourhoi.com',
  'eightcdn.com',
  'avking.xyz',
  'supjav.com',
  'javrate.com',
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // SSRF 防護：驗證協議與 hostname 白名單
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return new NextResponse('Disallowed protocol', { status: 400 });
  }
  const isAllowed = ALLOWED_HOSTS.some(
    (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
  );
  if (!isAllowed) {
    return new NextResponse('Disallowed host', { status: 400 });
  }

  try {
    let referer = 'https://missav.com/';
    if (parsed.hostname.includes('jable')) referer = 'https://jable.tv/';
    else if (parsed.hostname.includes('javrate') || parsed.hostname.includes('avking')) referer = 'https://javrate.com/';
    else if (parsed.hostname.includes('supjav')) referer = 'https://supjav.com/';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
