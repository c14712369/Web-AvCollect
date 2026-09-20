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
