import type { Movie } from '@/types/av';
import { randomUUID } from 'node:crypto';
import { getManualMovieIdentity, isPlaceholderMovie } from './manual-movie';

const WORKFLOW = 'backfill.yml';

export type MetadataDispatchResult =
  | { queued: true }
  | { queued: false; reason: string };

const AVBATCH_ENRICHMENT_SOURCES = new Set(['Jable', 'MissAV', 'Javrate']);

type EnrichmentCandidate = Pick<Movie, 'code' | 'title' | 'actress' | 'source' | 'imageUrl'> & {
  tags?: string | null;
};

interface SubmittedMetadata {
  source: string;
  url: string;
  metadataUnavailable: boolean;
}

interface DispatchOptions {
  repo?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  warn?: (message: string) => void;
}

function hasValidTags(raw: string | null | undefined): boolean {
  try {
    const tags: unknown = JSON.parse(raw ?? 'null');
    return Array.isArray(tags) && tags.length > 0 &&
      tags.every((tag) => typeof tag === 'string' && tag.trim().length > 0);
  } catch {
    return false;
  }
}

/** 依 persisted metadata 判斷缺漏，不使用 DTO 中由標題猜出的 themes 取代 raw tags。 */
export function needsMetadataEnrichment(
  movie: EnrichmentCandidate,
  metadataUnavailable: boolean
): boolean {
  if (!AVBATCH_ENRICHMENT_SOURCES.has(movie.source)) return false;
  return (
    metadataUnavailable ||
    !movie.title.trim() ||
    /^unknown title$/i.test(movie.title.trim()) ||
    movie.title.trim().toUpperCase() === movie.code.trim().toUpperCase() ||
    isPlaceholderMovie(movie) ||
    /(?:^|\.)fourhoi\.com$/i.test(coverHostname(movie.imageUrl)) ||
    !movie.actress?.trim() ||
    !hasValidTags(movie.tags)
  );
}

function coverHostname(imageUrl: string): string {
  try { return new URL(imageUrl).hostname; } catch { return ''; }
}

/** submitted 頁面失敗只影響同來源、同 URL 的 persisted movie。 */
export function needsPersistedMetadataEnrichment(
  movie: EnrichmentCandidate & Pick<Movie, 'url'>,
  submitted: SubmittedMetadata
): boolean {
  return needsMetadataEnrichment(movie, submitted.metadataUnavailable &&
    movie.source === submitted.source && movie.url === submitted.url);
}

/** 讀取與派送都屬新增後的增強，失敗只回傳 decision，不能改變 POST 成功結果。 */
export async function enrichPersistedMovie(
  movie: Omit<EnrichmentCandidate, 'tags'> & Pick<Movie, 'url'>,
  submitted: SubmittedMetadata,
  options: {
    loadMetadata: () => Promise<{ tags: string | null; actress: string | null }>;
    dispatch?: (code: string) => Promise<MetadataDispatchResult>;
    warn?: (message: string) => void;
  }
): Promise<MetadataDispatchResult> {
  if (!AVBATCH_ENRICHMENT_SOURCES.has(movie.source)) return { queued: false, reason: 'not-needed' };
  let metadata: { tags: string | null; actress: string | null };
  try {
    metadata = await options.loadMetadata();
  } catch {
    (options.warn ?? console.warn)('[metadata-enrichment] persisted metadata 讀取失敗');
    return { queued: false, reason: 'metadata-read-error' };
  }
  if (!needsPersistedMetadataEnrichment({ ...movie, ...metadata }, submitted)) {
    return { queued: false, reason: 'not-needed' };
  }
  try {
    return await (options.dispatch ?? dispatchMetadataEnrichment)(movie.code);
  } catch {
    return { queued: false, reason: 'network-error' };
  }
}

/** 沿用手動新增的番號擷取規則，並要求整串吻合、數字片號，避免任意 slug。 */
function normalizeDispatchCode(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (!/^(?:FC2-PPV-\d+|[A-Z]+\d*-\d+[A-Z]*)(?:-U)?$/.test(normalized)) return null;
  const identity = getManualMovieIdentity(`https://jable.tv/videos/${normalized.replace(/-U$/, '')}/`);
  return identity.code === normalized.replace(/-U$/, '') ? normalized : null;
}

function safeDiagnostic(value: string, token: string, limit: number): string {
  return value.split(token).join('[redacted]').replace(/[\r\n\t]/g, ' ').slice(0, limit);
}

/**
 * 派送指定番號到 AvBatch backfill workflow。
 * 派送屬非同步增強；設定缺漏或 GitHub API 失敗都不可讓新增影片本身失敗。
 */
export async function dispatchMetadataEnrichment(
  code: string,
  options: DispatchOptions = {}
): Promise<MetadataDispatchResult> {
  const repo = options.repo ?? process.env.GITHUB_REPO ?? '';
  const token = options.token ?? process.env.GITHUB_TOKEN ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;
  const warn = options.warn ?? console.warn;

  const normalizedCode = normalizeDispatchCode(code);
  if (!normalizedCode) return { queued: false, reason: 'invalid-code' };
  if (!repo || !token) return { queued: false, reason: 'missing-config' };

  const requestId = randomUUID();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      let result: { status: number; ok: boolean; githubRequestId: string; message: string };
      try {
        // Promise.race 同時保護 fetch 與 response body；即使 fetch 不理會 abort 仍有界結束。
        result = await Promise.race([
          (async () => {
            const response = await fetchImpl(
              `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`,
              {
                method: 'POST',
                signal: controller.signal,
                headers: {
                  Accept: 'application/vnd.github+json',
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  'X-GitHub-Api-Version': '2022-11-28',
                },
                body: JSON.stringify({
                  ref: 'main',
                  inputs: { code: normalizedCode, limit: '1', request_id: requestId },
                }),
              }
            );
            let message = '';
            if (!response.ok) {
              try {
                const body: unknown = await response.json();
                if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
                  message = body.message;
                }
              } catch { /* 非 JSON 錯誤只記 HTTP status。 */ }
            }
            return { status: response.status, ok: response.ok,
              githubRequestId: response.headers.get('x-github-request-id') ?? '', message };
          })(),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
              timedOut = true;
              controller.abort();
              reject(new Error('dispatch-timeout'));
            }, 3000);
          }),
        ]);
      } catch {
        warn(`[metadata-enrichment] request_id=${requestId} ${timedOut ? 'timeout' : 'network-error'}`);
        return { queued: false, reason: timedOut ? 'timeout' : 'network-error' };
      } finally {
        clearTimeout(timer);
      }
      if (result.ok) return { queued: true }; // 僅代表已 queued，metadata 尚待 AvBatch 完成。
      warn(`[metadata-enrichment] request_id=${requestId} HTTP ${result.status} x-github-request-id=${safeDiagnostic(result.githubRequestId, token, 80)} message=${safeDiagnostic(result.message, token, 200)}`);
      if (attempt === 2 || !(result.status === 429 || result.status >= 500 && result.status <= 599)) {
        return { queued: false, reason: `github-${result.status}` };
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  } catch {
    return { queued: false, reason: 'network-error' };
  }
  return { queued: false, reason: 'network-error' };
}
