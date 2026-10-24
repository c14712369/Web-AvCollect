'use client';

import { useQuery } from '@tanstack/react-query';

const QUERY_KEY = ['preferred-actresses'] as const;

const fetchPreferredActresses = async (): Promise<string[]> => {
  const res = await fetch('/api/config');
  // 失敗要拋錯讓 React Query 進 error 狀態並重試，不可快取成「沒有喜愛女優」
  if (!res.ok) throw new Error(`讀取喜愛女優失敗：HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.preferredActresses)) throw new Error('讀取喜愛女優失敗：回應缺少 preferredActresses');
  return json.preferredActresses;
};

/** 牆面「喜愛女優」篩選用：讀取設定頁手動維護的女優清單。 */
export const usePreferredActresses = (): string[] => {
  const { data = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchPreferredActresses,
    staleTime: 60_000,
  });
  return data;
};
