import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import { extractMaker, extractThemes, extractActress } from '@/lib/metadata';

const dataPath = path.join(process.cwd(), 'src', 'lib', 'data.json');

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });

    let source = 'Unknown';
    if (url.includes('jable.tv')) source = 'Jable';
    else if (url.includes('missav')) source = 'MissAV';
    else if (url.includes('javrate.com')) source = 'Javrate';

    // Fetch HTML
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract Metadata
    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Unknown Title';
    let imageUrl = $('meta[property="og:image"]').attr('content') || '';
    
    // Fallback image scraping
    if (!imageUrl) {
      if (source === 'Jable') {
        imageUrl = $('.video-img-box img').attr('src') || '';
      } else if (source === 'MissAV') {
        imageUrl = $('video').attr('poster') || '';
      }
    }

    // Attempt to extract code from URL or Title
    let code = 'UNKNOWN';
    const codeMatch = title.match(/[A-Z0-9]+-[0-9A-Z]+/i) || url.match(/\/([a-zA-Z0-9]+-[0-9A-Z]+)[\/\?]?/);
    if (codeMatch) {
      code = codeMatch[1].toUpperCase();
    }

    const movie = {
      code,
      title,
      url,
      imageUrl,
      source,
      category: 'User Added',
    };

    // Save to data.json
    const rawData = await fs.readFile(dataPath, 'utf-8');
    const movies = JSON.parse(rawData);
    
    // Prevent duplicates
    if (!movies.find((m: any) => m.code === code)) {
      movies.unshift(movie); // Add to top
      await fs.writeFile(dataPath, JSON.stringify(movies, null, 2), 'utf-8');
    }

    return NextResponse.json({ 
      success: true, 
      movie: {
        ...movie,
        maker: extractMaker(code),
        themes: extractThemes(title),
        actress: extractActress(title)
      } 
    });
  } catch (error) {
    console.error('Add Movie Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
