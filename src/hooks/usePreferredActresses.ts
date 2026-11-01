'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyListDelta } from '@/lib/config-patch';

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

export interface ToggleActressPayload {
  names: string[];
  action: 'add' | 'remove';
}

/**
 * 喜愛女優快捷切換（右鍵選單用）。
 * 遵守守則：以 delta 方式送出 add / remove，禁止整份清單覆蓋。
 */
export const useTogglePreferredActress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ names, action }: ToggleActressPayload) => {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredActresses: action === 'add' ? { add: names } : { remove: names },
        }),
      });
      if (!res.ok) throw new Error(`喜愛女優更新失敗：HTTP ${res.status}`);
      return res.json();
    },
    onMutate: async ({ names, action }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData<string[]>(QUERY_KEY);
      if (prev) {
        const delta = action === 'add' ? { add: names } : { remove: names };
        queryClient.setQueryData(QUERY_KEY, applyListDelta(prev, delta));
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['movies'] });
    },
  });
};


