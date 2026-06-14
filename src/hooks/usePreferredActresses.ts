'use client';

import { useQuery } from '@tanstack/react-query';

const QUERY_KEY = ['preferred-actresses'] as const;

const fetchPreferredActresses = async (): Promise<string[]> => {
  const res = await fetch('/api/config');
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.preferredActresses) ? json.preferredActresses : [];
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
