/**
 * 圖片網域白名單的唯一來源，值是該圖床防盜連要求的 Referer。
 * /api/image-proxy 的 SSRF 防護與 next.config.ts 的 images.remotePatterns 都由此產生；
 * 新增片源圖床只改這張表（本檔不可使用 @/ 別名，next.config.ts 會直接 import）。
 */
export const IMAGE_HOST_REFERERS = {
  'sixyik.com': 'https://missav.com/',
  'cdn.jable.tv': 'https://jable.tv/',
  'jable.tv': 'https://jable.tv/',
  'missav.com': 'https://missav.com/',
  'fourhoi.com': 'https://missav.ai/',
  'eightcdn.com': 'https://missav.com/',
  'avking.xyz': 'https://javrate.com/',
  'supjav.com': 'https://supjav.com/',
  'javrate.com': 'https://javrate.com/',
} as const satisfies Record<string, string>;

type ImageHost = keyof typeof IMAGE_HOST_REFERERS;

export const IMAGE_HOSTS = Object.keys(IMAGE_HOST_REFERERS) as ImageHost[];

/** hostname 本身或其子網域在白名單內才回傳對應的白名單網域。 */
const matchImageHost = (hostname: string): ImageHost | undefined =>
  IMAGE_HOSTS.find((h) => hostname === h || hostname.endsWith('.' + h));

export const isAllowedImageHost = (hostname: string): boolean => matchImageHost(hostname) !== undefined;

export function getImageReferer(parsed: URL): string {
  const host = matchImageHost(parsed.hostname);
  return host ? IMAGE_HOST_REFERERS[host] : 'https://missav.com/';
}
