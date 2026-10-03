export type ManualMovieSource = 'Jable' | 'Javrate' | 'MissAV' | 'SupJav' | 'Unknown';

const SOURCE_PRIORITY: Record<ManualMovieSource, number> = {
  Jable: 3,
  Javrate: 2,
  MissAV: 1,
  SupJav: 0,
  Unknown: 0,
};

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

/** 同片號只允許高優先片源升級：Jable > Javrate > MissAV。 */
export function shouldUpgradeSource(current: string, incoming: string): boolean {
  const currentPriority = SOURCE_PRIORITY[current as ManualMovieSource] ?? 0;
  const incomingPriority = SOURCE_PRIORITY[incoming as ManualMovieSource] ?? 0;
  return incomingPriority > currentPriority;
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
