import assert from 'node:assert/strict';
import test from 'node:test';
import type { Movie } from '@/types/av';
import { sortMovies, type SortDirection } from './movie-sort';

const movie = (overrides: Partial<Movie>): Movie => ({
  code: 'TEST-001',
  title: '測試影片',
  url: 'https://example.com',
  imageUrl: 'https://example.com/cover.jpg',
  source: 'Test',
  category: 'Test',
  maker: '',
  themes: [],
  ...overrides,
});

test('收藏時間可依新增時間升冪與降冪排列', () => {
  const works = [
    movie({ code: 'NEW', addedAt: '2026-09-19T02:38:29.000Z' }),
    movie({ code: 'OLD', addedAt: '2026-07-01T00:00:00.000Z' }),
  ];

  assert.deepEqual(sortMovies(works, 'added', 'asc').map((work) => work.code), ['OLD', 'NEW']);
  assert.deepEqual(sortMovies(works, 'added', 'desc').map((work) => work.code), ['NEW', 'OLD']);
});

test('女優名稱可依升冪與降冪排列，未知女優固定排在最後', () => {
  const works = [
    movie({ code: 'UNKNOWN', actress: null }),
    movie({ code: 'A', actress: '明里紬' }),
    movie({ code: 'B', actress: '三上悠亞' }),
  ];

  assert.deepEqual(sortMovies(works, 'actress', 'asc').map((work) => work.code), ['B', 'A', 'UNKNOWN']);
  assert.deepEqual(sortMovies(works, 'actress', 'desc').map((work) => work.code), ['A', 'B', 'UNKNOWN']);
});
