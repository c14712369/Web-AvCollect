import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dispatchMetadataEnrichment,
  enrichPersistedMovie,
  needsMetadataEnrichment,
  needsPersistedMetadataEnrichment,
} from './metadata-enrichment';

const completeMovie = {
  code: 'FNS-098',
  title: 'FNS-098 完整標題',
  actress: '浜辺やよい',
  source: 'Jable',
  url: 'https://jable.tv/videos/fns-098/',
  imageUrl: 'https://cdn.jable.tv/fns-098.jpg',
  tags: '["劇情"]',
};

test('詳情頁不可用時需要交給 AvBatch 回補', () => {
  assert.equal(needsMetadataEnrichment(completeMovie, true), true);
});

test('標題仍等於番號或女優缺漏時需要回補', () => {
  assert.equal(
    needsMetadataEnrichment({ ...completeMovie, title: completeMovie.code }, false),
    true
  );
  assert.equal(needsMetadataEnrichment({ ...completeMovie, actress: null }, false), true);
});

test('metadata 完整時不需派送回補', () => {
  assert.equal(needsMetadataEnrichment(completeMovie, false), false);
});

test('AvBatch 尚未支援的片源不派送回補', () => {
  assert.equal(
    needsMetadataEnrichment(
      { ...completeMovie, source: 'SupJav', title: completeMovie.code, actress: null },
      true
    ),
    false
  );
});

test('以標準化番號派送指定 AvBatch workflow', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(null, { status: 204 });
  };

  const result = await dispatchMetadataEnrichment('fns-098', {
    repo: 'owner/AvBatch',
    token: 'secret-token',
    fetchImpl,
  });

  assert.deepEqual(result, { queued: true });
  assert.equal(
    requestedUrl,
    'https://api.github.com/repos/owner/AvBatch/actions/workflows/backfill.yml/dispatches'
  );
  assert.equal(requestedInit?.method, 'POST');
  const payload = JSON.parse(String(requestedInit?.body));
  assert.equal(payload.ref, 'main');
  assert.deepEqual(Object.keys(payload.inputs).sort(), ['code', 'limit', 'request_id']);
  assert.equal(payload.inputs.code, 'FNS-098');
  assert.equal(payload.inputs.limit, '1');
  assert.match(payload.inputs.request_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('未設定 GitHub credentials 時略過，不影響新增影片', async () => {
  let called = false;
  const result = await dispatchMetadataEnrichment('FNS-098', {
    repo: '',
    token: '',
    fetchImpl: async () => {
      called = true;
      return new Response(null, { status: 204 });
    },
  });

  assert.equal(called, false);
  assert.deepEqual(result, { queued: false, reason: 'missing-config' });
});

test('GitHub dispatch 失敗時回傳狀態而不丟出例外', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = dispatchMetadataEnrichment('FNS-098', {
    repo: 'owner/AvBatch',
    token: 'secret-token',
    fetchImpl: async () => new Response('rate limited', { status: 429 }),
    warn: () => undefined,
  });
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); t.mock.timers.tick(1000); }
  assert.deepEqual(await pending, { queued: false, reason: 'github-429' });
});

test('空白、錯誤頁標題、猜測或死鏈封面均需回補', () => {
  for (const title of ['', '   ', 'Unknown Title', '404 Not Found', 'Just a moment...']) {
    assert.equal(needsMetadataEnrichment({ ...completeMovie, title }, false), true, title);
  }
  for (const imageUrl of ['', '  ', 'invalid', 'https://fourhoi.com/fns-098/cover-n.jpg', 'https://sixyik.com/fns-098.jpg']) {
    assert.equal(needsMetadataEnrichment({ ...completeMovie, imageUrl }, false), true, imageUrl);
  }
});

test('空白、無效 JSON、非字串或空陣列 tags 均需回補', () => {
  for (const tags of [null, '', ' ', '[]', '[" "]', '{"tag":"劇情"}', 'invalid', '[null]', '[1]', '["劇情",1]']) {
    assert.equal(needsMetadataEnrichment({ ...completeMovie, tags }, false), true, String(tags));
  }
});

test('UNKNOWN、空白與非番號不得送出 GitHub request', async () => {
  for (const code of ['UNKNOWN', '', '  ', 'not-a-movie', 'FNS-098 trailing', 'https://jable.tv/FNS-098']) {
    let calls = 0;
    const result = await dispatchMetadataEnrichment(code, {
      repo: 'owner/AvBatch', token: 'secret-token',
      fetchImpl: async () => { calls++; return new Response(null, { status: 204 }); },
    });
    assert.deepEqual(result, { queued: false, reason: 'invalid-code' }, code);
    assert.equal(calls, 0);
  }
});

test('429 與 5xx 會有界重試，重試沿用同一 request ID', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const statuses = [429, 503, 204];
  const bodies: Array<{ inputs: { request_id: string } }> = [];
  const pending = dispatchMetadataEnrichment('FNS-098', {
    repo: 'owner/AvBatch', token: 'secret-token', warn: () => undefined,
    fetchImpl: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: statuses.shift()! });
    },
  });
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); t.mock.timers.tick(1000); }
  assert.deepEqual(await pending, { queued: true });
  assert.equal(bodies.length, 3);
  assert.equal(new Set(bodies.map((body) => body.inputs.request_id)).size, 1);
});

test('持續 5xx 最多三次，其他 4xx 不重試', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const [status, expectedCalls] of [[500, 3], [401, 1], [403, 1], [404, 1], [422, 1]]) {
    let calls = 0;
    const pending = dispatchMetadataEnrichment('FNS-098', {
      repo: 'owner/AvBatch', token: 'secret-token', warn: () => undefined,
      fetchImpl: async () => { calls++; return new Response(null, { status }); },
    });
    for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); t.mock.timers.tick(1000); }
    assert.deepEqual(await pending, { queued: false, reason: `github-${status}` });
    assert.equal(calls, expectedCalls);
  }
});

test('不理會 AbortSignal 的 fetch 在 2999 ms 仍 pending、3000 ms timeout，且只呼叫一次', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const scheduled = t.mock.method(globalThis, 'setTimeout');
  const cleared = t.mock.method(globalThis, 'clearTimeout');
  let signal: AbortSignal | undefined;
  let calls = 0;
  let settled = false;
  const pending = dispatchMetadataEnrichment('FNS-098', {
    repo: 'owner/AvBatch', token: 'secret-token', warn: () => undefined,
    fetchImpl: async (_input, init) => {
      calls++;
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    },
  });
  void pending.then(() => { settled = true; });
  assert.ok(signal);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(2999);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  assert.equal(signal.aborted, false);
  assert.equal(calls, 1);
  assert.equal(cleared.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.deepEqual(await pending, { queued: false, reason: 'timeout' });
  assert.equal(settled, true);
  assert.equal(signal.aborted, true);
  assert.equal(cleared.mock.callCount(), 1);
  assert.equal(cleared.mock.calls[0].arguments[0], scheduled.mock.calls[0].result);
  t.mock.timers.tick(10_000);
  assert.equal(calls, 1);
});

test('network rejection 不 throw、不重試、不洩漏 token，且清除 timeout timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const scheduled = t.mock.method(globalThis, 'setTimeout');
  const cleared = t.mock.method(globalThis, 'clearTimeout');
  const warnings: string[] = [];
  let calls = 0;
  let signal: AbortSignal | undefined;
  const result = await dispatchMetadataEnrichment('FNS-098', {
    repo: 'owner/AvBatch', token: 'secret-token', warn: (message) => warnings.push(message),
    fetchImpl: async (_input, init) => {
      calls++;
      signal = init?.signal ?? undefined;
      throw new Error('Authorization: Bearer secret-token');
    },
  });
  assert.deepEqual(result, { queued: false, reason: 'network-error' });
  assert.equal(warnings.join('').includes('secret-token'), false);
  assert.equal(cleared.mock.callCount(), 1);
  assert.equal(cleared.mock.calls[0].arguments[0], scheduled.mock.calls[0].result);
  t.mock.timers.tick(10_000);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.ok(signal);
  assert.equal(signal.aborted, false);
  assert.equal(warnings.length, 1);
});

test('response.json 永不 resolve 時同樣受 3000 ms deadline 保護，不重試並清除 timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const scheduled = t.mock.method(globalThis, 'setTimeout');
  const cleared = t.mock.method(globalThis, 'clearTimeout');
  const response = new Response(null, { status: 403 });
  const body = t.mock.method(response, 'json', async () => new Promise<unknown>(() => undefined));
  let calls = 0;
  let signal: AbortSignal | undefined;
  let settled = false;
  const pending = dispatchMetadataEnrichment('FNS-098', {
    repo: 'owner/AvBatch', token: 'secret-token', warn: () => undefined,
    fetchImpl: async (_input, init) => {
      calls++;
      signal = init?.signal ?? undefined;
      return response;
    },
  });
  void pending.then(() => { settled = true; });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(body.mock.callCount(), 1);
  t.mock.timers.tick(2999);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  assert.ok(signal);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  assert.deepEqual(await pending, { queued: false, reason: 'timeout' });
  assert.equal(signal.aborted, true);
  assert.equal(cleared.mock.callCount(), 1);
  assert.equal(cleared.mock.calls[0].arguments[0], scheduled.mock.calls[0].result);
  t.mock.timers.tick(10_000);
  assert.equal(calls, 1);
  assert.equal(body.mock.callCount(), 1);
});

test('成功與 HTTP 失敗都清除正確的 timer，deadline 後不再 abort 或派送', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const scheduled = t.mock.method(globalThis, 'setTimeout');
  const cleared = t.mock.method(globalThis, 'clearTimeout');
  for (const [index, status] of [204, 403].entries()) {
    let calls = 0;
    let signal: AbortSignal | undefined;
    const result = await dispatchMetadataEnrichment('FNS-098', {
      repo: 'owner/AvBatch', token: 'secret-token', warn: () => undefined,
      fetchImpl: async (_input, init) => {
        calls++;
        signal = init?.signal ?? undefined;
        return new Response(null, { status });
      },
    });
    assert.deepEqual(result, status === 204 ? { queued: true } : { queued: false, reason: 'github-403' });
    assert.equal(cleared.mock.callCount(), index + 1);
    assert.equal(cleared.mock.calls[index].arguments[0], scheduled.mock.calls[index].result);
    t.mock.timers.tick(10_000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(signal);
    assert.equal(signal.aborted, false);
    assert.equal(calls, 1);
  }
});

test('安全 diagnostics 包含 status、GitHub request ID、截斷 message 並遮罩 token', async () => {
  const warnings: string[] = [];
  const result = await dispatchMetadataEnrichment('FNS-098', {
    repo: 'owner/AvBatch', token: 'secret-token', warn: (message) => warnings.push(message),
    fetchImpl: async () => new Response(JSON.stringify({ message: `Permission denied secret-token ${'x'.repeat(1000)}` }), {
      status: 403, headers: { 'x-github-request-id': 'GH-123' },
    }),
  });
  assert.deepEqual(result, { queued: false, reason: 'github-403' });
  assert.match(warnings.join(''), /HTTP 403/);
  assert.match(warnings.join(''), /GH-123/);
  assert.match(warnings.join(''), /Permission denied/);
  assert.equal(warnings.join('').includes('secret-token'), false);
  assert.ok(warnings.join('').length < 500);
});

test('submitted source／URL 不匹配時，失敗狀態不得污染 persisted movie', () => {
  assert.equal(needsPersistedMetadataEnrichment(completeMovie, {
    source: 'MissAV', url: 'https://missav.ws/fns-098', metadataUnavailable: true,
  }), false);
  assert.equal(needsPersistedMetadataEnrichment(completeMovie, {
    source: 'Jable', url: 'https://jable.tv/videos/other/', metadataUnavailable: true,
  }), false);
  assert.equal(needsPersistedMetadataEnrichment(completeMovie, {
    source: completeMovie.source, url: completeMovie.url, metadataUnavailable: true,
  }), true);
  assert.equal(needsPersistedMetadataEnrichment({ ...completeMovie, actress: '' }, {
    source: 'MissAV', url: 'https://missav.ws/fns-098', metadataUnavailable: true,
  }), true);
});

test('dispatch failure 是可安全附加於成功 API 的 decision', async () => {
  const result = await enrichPersistedMovie(completeMovie, {
    source: completeMovie.source, url: completeMovie.url, metadataUnavailable: false,
  }, { loadMetadata: async () => ({ tags: null, actress: completeMovie.actress }), dispatch: async () => ({ queued: false, reason: 'github-403' }) });
  assert.deepEqual(result, { queued: false, reason: 'github-403' });
});

test('raw tags 讀取失敗不 throw 到新增 route，也不派送', async () => {
  let calls = 0;
  const result = await enrichPersistedMovie(completeMovie, {
    source: completeMovie.source, url: completeMovie.url, metadataUnavailable: false,
  }, {
    loadMetadata: async () => { throw new Error('database unavailable'); },
    dispatch: async () => { calls++; return { queued: false, reason: 'github-403' }; },
    warn: () => undefined,
  });
  assert.deepEqual(result, { queued: false, reason: 'metadata-read-error' });
  assert.equal(calls, 0);
});

test('DTO 猜測女優不得掩蓋 raw actress 缺漏', async () => {
  const options = {
    loadMetadata: async () => ({ tags: completeMovie.tags, actress: null }),
    dispatch: async (): Promise<{ queued: false; reason: string }> => ({ queued: false, reason: 'github-403' }),
    warn: () => undefined,
  };
  const result = await enrichPersistedMovie(completeMovie, {
    source: completeMovie.source, url: completeMovie.url, metadataUnavailable: false,
  }, options);
  assert.deepEqual(result, { queued: false, reason: 'github-403' });
});
