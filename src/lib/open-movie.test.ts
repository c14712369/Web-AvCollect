import assert from 'node:assert/strict';
import test from 'node:test';
import type { Movie } from '@/types/av';
import { hasBackgroundTabBridge, openMovieExternally } from './open-movie';

const movie: Movie = {
  code: 'TEST-001',
  title: 'Test movie',
  url: 'https://example.com/movie',
  imageUrl: '',
  source: 'test',
  category: 'test',
  maker: 'test',
  themes: [],
};

function browserWindow({
  legacyFlag = false,
  domMarker = null,
}: {
  legacyFlag?: boolean;
  domMarker?: string | null;
} = {}) {
  return {
    __AVCOLLECT_EXT_INSTALLED__: legacyFlag,
    document: {
      documentElement: {
        getAttribute: (name: string) =>
          name === 'data-avcollect-background-tabs' ? domMarker : null,
      },
    },
  } as unknown as Window;
}

test('detects the CSP-safe extension marker', () => {
  assert.equal(hasBackgroundTabBridge(browserWindow({ domMarker: 'true' })), true);
});

test('keeps compatibility with the legacy page-world marker', () => {
  assert.equal(hasBackgroundTabBridge(browserWindow({ legacyFlag: true })), true);
});

test('uses the normal browser fallback without an extension marker', () => {
  assert.equal(hasBackgroundTabBridge(browserWindow()), false);
});

test('does not open a second tab when the extension acknowledges the request', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalFetch = globalThis.fetch;
  const eventTarget = new EventTarget();
  let fallbackOpenCount = 0;
  eventTarget.addEventListener('avcollect:open-background-tab', (event) => event.preventDefault());

  const mockWindow = Object.assign(eventTarget, {
    document: browserWindow().document,
    open: () => {
      fallbackOpenCount += 1;
      return null;
    },
  });

  Object.defineProperty(globalThis, 'window', { configurable: true, value: mockWindow });
  globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;

  try {
    openMovieExternally(movie);
    assert.equal(fallbackOpenCount, 0);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    globalThis.fetch = originalFetch;
  }
});
