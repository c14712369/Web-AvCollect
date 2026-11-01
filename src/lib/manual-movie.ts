export type ManualMovieSource = 'Jable' | 'Javrate' | 'MissAV' | 'SupJav' | 'Unknown';

export interface SourceEvaluationContext {
  source: string;
  code?: string | null;
  title?: string | null;
  url?: string | null;
  tags?: string | null;
  resolution?: string | null;
}

/** 判斷是否為無碼影片（-U 無碼流出、FC2/加勒比等天然無碼、標題/標籤含無碼/破解，嚴格排除純劇情「體液流出」等字眼） */
export function isUncensoredItem(item: SourceEvaluationContext): boolean {
  const code = (item.code || '').toUpperCase();
  if (code.endsWith('-U')) return true;
  if (/^(?:FC2(?:-PPV)?|CARIB(?:PR)?|1PON(?:DO)?|PACO(?:PACOMAMA)?|10MU(?:SUME)?|HEYZO|C0930|H0930|H4610|KB|MKBD|SIRO)-/i.test(code)) return true;

  const title = item.title || '';
  if (/無碼|無修正|步兵|uncensored|leaked|無碼流出|破解版/i.test(title)) return true;

  const tags = item.tags || '';
  if (/無碼|無修正|步兵|uncensored|leaked|無碼流出|破解版/i.test(tags)) return true;

  const url = item.url || '';
  if (/uncensored-leak/i.test(url)) return true;

  return false;
}

/** 偵測畫質等級權重：4K (100) > 1080p (50) > 720p (20) > 480p (5) */
export function detectResolutionRank(item: SourceEvaluationContext): number {
  const combined = `${item.resolution || ''} ${item.title || ''} ${item.tags || ''} ${item.url || ''}`;
  if (/\b(?:4k|2160p)\b/i.test(combined)) return 100;
  if (/\b(?:1080p|fhd)\b/i.test(combined)) return 50;
  if (/\b(?:720p|hd)\b/i.test(combined)) return 20;
  // 排除 SOD 旗下的 SD-xxx 系列番號誤判
  if (/\b(?:480p)\b|\[sd\]|\(sd\)|\bsd\b(?!-)/i.test(combined)) return 5;
  return 20; // 預設 HD 720p
}

const SOURCE_CENSORED_RANK: Record<string, number> = {
  Jable: 10,
  MissAV: 8,
  Javrate: 5,
  SupJav: 3,
};

const SOURCE_UNCENSORED_RANK: Record<string, number> = {
  Javrate: 10,
  MissAV: 8,
  Jable: 5,
  SupJav: 3,
};

/**
 * 計算片源綜合評分（供排序比較參考）
 */
export function calculateSourceScore(input: string | SourceEvaluationContext): number {
  const ctx: SourceEvaluationContext = typeof input === 'string' ? { source: input } : input;
  const source = ctx.source;
  const resolutionScore = detectResolutionRank(ctx);
  const uncensored = isUncensoredItem(ctx);

  let uncensoredBonus = 0;
  if (uncensored) {
    if (source === 'Javrate') uncensoredBonus = 40;
    else if (source === 'MissAV') uncensoredBonus = 35;
    else uncensoredBonus = 25;
  }

  const baseScore = SOURCE_CENSORED_RANK[source] ?? 0;
  return resolutionScore + uncensoredBonus + baseScore;
}

function sourceFromHostname(hostname: string): ManualMovieSource {
  if (hostname.endsWith('jable.tv')) return 'Jable';
  if (hostname.includes('missav')) return 'MissAV';
  if (hostname.endsWith('javrate.com')) return 'Javrate';
  if (hostname.endsWith('supjav.com')) return 'SupJav';
  return 'Unknown';
}

function codeFromPathname(pathname: string): string | null {
  const decoded = decodeURIComponent(pathname);
  const match = decoded.match(/(?:fc2-ppv-\d+|[a-z]+\d*-[0-9a-z]+)\b/i);
  return match ? match[0].toUpperCase() : null;
}

/** 從手動網址取得站台與標準番號；無碼流出與有碼片為兩筆不同內容。 */
export function getManualMovieIdentity(url: string): {
  code: string | null;
  source: ManualMovieSource;
  isUncensored: boolean;
} {
  const parsed = new URL(url);
  const source = sourceFromHostname(parsed.hostname.toLowerCase());
  const isUncensored = source === 'MissAV' && /uncensored-leak/i.test(parsed.pathname);
  const baseCode = codeFromPathname(parsed.pathname);
  return {
    code: baseCode && isUncensored ? `${baseCode}-U` : baseCode,
    source,
    isUncensored,
  };
}

/**
 * 階梯式判定兩片源是否允許升級：
 * 1. 未知來源一律不得覆蓋已知來源
 * 2. 畫質優先：4K > 1080p > 720p > 480p
 * 3. 畫質相同時，無碼版優先（無碼 > 有碼）
 * 4. 畫質與有無碼均相同時，播放體驗佳者優先（Jable > MissAV > Javrate）
 */
export function shouldUpgradeSource(
  current: string | SourceEvaluationContext,
  incoming: string | SourceEvaluationContext
): boolean {
  const curCtx: SourceEvaluationContext = typeof current === 'string' ? { source: current } : current;
  const inCtx: SourceEvaluationContext = typeof incoming === 'string' ? { source: incoming } : incoming;

  // 未知來源一律不得覆蓋已知來源
  const curRank = SOURCE_CENSORED_RANK[curCtx.source] ?? 0;
  const inRank = SOURCE_CENSORED_RANK[inCtx.source] ?? 0;
  if (curRank > 0 && inRank === 0) return false;

  // 1. 畫質等級比較
  const curRes = detectResolutionRank(curCtx);
  const inRes = detectResolutionRank(inCtx);
  if (inRes > curRes) return true;
  if (inRes < curRes) return false;

  // 2. 畫質相同，比較是否無碼
  const curUncensored = isUncensoredItem(curCtx);
  const inUncensored = isUncensoredItem(inCtx);
  if (curUncensored && !inUncensored) return false;
  if (!curUncensored && inUncensored) return true;

  // 3. 畫質與有無碼皆相同：
  // 若為無碼片，Javrate 優先保留；若為普通有碼片，Jable 優先播放
  if (curUncensored && inUncensored) {
    const curUncRank = SOURCE_UNCENSORED_RANK[curCtx.source] ?? 0;
    const inUncRank = SOURCE_UNCENSORED_RANK[inCtx.source] ?? 0;
    return inUncRank > curUncRank;
  }

  return inRank > curRank;
}

/** 已停用的封面 CDN（sixyik 目前回 525），存著這種網址等同沒有封面。 */
const DEAD_COVER_HOSTS = ['sixyik.com'];

/**
 * 詳情頁被 Cloudflare 擋下時的封面備援：MissAV 的封面 CDN（fourhoi）不在 CF 後面，
 * 且以「網址 slug」為路徑。MissAV 直接用網址最後一段（保留 -uncensored-leak），
 * 其他站以小寫基本番號猜（Jable 多數片 MissAV 也有）。
 */
export function getFallbackCoverUrl(url: string, code: string): string {
  if (!code || code === 'UNKNOWN') return '';
  const parsed = new URL(url);
  const slug =
    sourceFromHostname(parsed.hostname.toLowerCase()) === 'MissAV'
      ? parsed.pathname.split('/').filter(Boolean).pop()
      : code.replace(/-U$/, '');
  return slug ? `https://fourhoi.com/${slug.toLowerCase()}/cover-n.jpg` : '';
}

/** 新增時詳情頁被擋而只存了番號當標題、或封面缺失/死鏈的片，重新加入時允許補資料。 */
export function isPlaceholderMovie(movie: { code: string; title: string; imageUrl: string }): boolean {
  if (movie.title.trim() === movie.code || ERROR_PAGE_TITLE.test(movie.title)) return true;
  if (!movie.imageUrl) return true;
  try {
    return DEAD_COVER_HOSTS.some((h) => new URL(movie.imageUrl).hostname.endsWith(h));
  } catch {
    return true;
  }
}

/** 錯誤頁標題：整串比對已知片語，避免「500 人斬り」「…NOT FOUND 特典」這類正常片名被誤判。 */
const ERROR_PAGE_TITLE =
  /^\s*(?:[45]\d{2}(?:\s*[-:|]?\s*(?:not found|forbidden|unauthorized|internal server error|bad gateway|service unavailable|gateway time-?out|error))?|(?:page\s+)?not\s+found)\s*$|Attention Required|Just a moment|you have been blocked|Enable JavaScript and cookies/i;

/** 詳情頁回非 2xx（已下架 404、CF 403）或是挑戰頁 → 頁面上的標題/封面都不能用。 */
export function isUnusableDetailPage(status: number, title: string): boolean {
  return status < 200 || status >= 300 || ERROR_PAGE_TITLE.test(title);
}

/** 新增/補資料成功後更新快取：同番號就地取代，新片插到最前面。 */
export function mergeAddedMovie<T extends { code: string }>(prev: T[] | undefined, movie: T): T[] {
  if (!prev) return [movie];
  return prev.some((m) => m.code === movie.code)
    ? prev.map((m) => (m.code === movie.code ? movie : m))
    : [movie, ...prev];
}

/** 既有連結是否已失效（當初存到的是 404 等錯誤頁標題）。 */
export function hasDeadLink(movie: { title: string }): boolean {
  return ERROR_PAGE_TITLE.test(movie.title);
}

interface RepairableMovie {
  code: string;
  title: string;
  url: string;
  imageUrl: string;
  source: string;
  tags?: string | null;
  actress?: string | null;
}

function hasUsableCover(imageUrl: string): boolean {
  if (!imageUrl) return false;
  try {
    return !DEAD_COVER_HOSTS.some((h) => new URL(imageUrl).hostname.endsWith(h));
  } catch {
    return false;
  }
}

/**
 * 佔位片的補資料欄位：只挑「這次比既有好」的欄位，沒有任何改善回傳 null。
 * 既有連結已下架（錯誤頁標題）時，拿到真標題的片源可接手連結。
 */
export function getPlaceholderRepairPatch(
  current: RepairableMovie,
  incoming: RepairableMovie
): Partial<RepairableMovie> | null {
  if (!isPlaceholderMovie(current)) return null;
  const incomingHasTitle = incoming.title.trim() !== incoming.code && !ERROR_PAGE_TITLE.test(incoming.title);
  const patch: Partial<RepairableMovie> = {};
  if (incomingHasTitle && (current.title.trim() === current.code || hasDeadLink(current))) {
    patch.title = incoming.title;
    if (hasDeadLink(current)) {
      patch.url = incoming.url;
      patch.source = incoming.source;
    }
  } else if (hasDeadLink(current)) {
    patch.title = current.code;
  }
  if (!hasUsableCover(current.imageUrl) && hasUsableCover(incoming.imageUrl)) patch.imageUrl = incoming.imageUrl;
  if (!current.actress && incoming.actress) patch.actress = incoming.actress;
  if (!current.tags && incoming.tags) patch.tags = incoming.tags;
  return Object.keys(patch).length > 0 ? patch : null;
}
