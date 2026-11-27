const SESSION_VERSION = 'avc-v1';
export const AUTH_COOKIE = 'avc_auth';
/** 瀏覽器 RFC 6265bis 單次 Cookie Max-Age 上限（400 天），搭配 Middleware 滑動續期實現登入後永久有效。 */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/** 產生登入驗證 Cookie 的共用設定；登出時傳入 maxAge=0 清除。 */
export function getAuthCookieOptions(maxAge: number = AUTH_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/** 判斷該路徑通過驗證時是否應刷新 Cookie 效期（排除登出與高頻圖片代理）。 */
export function shouldRefreshSessionCookie(pathname: string): boolean {
  return (
    pathname !== '/api/auth/logout' &&
    !pathname.startsWith('/api/auth/logout/') &&
    pathname !== '/api/image-proxy' &&
    !pathname.startsWith('/api/image-proxy/')
  );
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function expectedSessionHash(secret: string): Promise<string> {
  return sha256(`${secret}:${SESSION_VERSION}`);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function isValidSession(
  cookieValue: string | undefined,
  secret: string
): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await expectedSessionHash(secret);
  return timingSafeEqual(cookieValue, expected);
}
