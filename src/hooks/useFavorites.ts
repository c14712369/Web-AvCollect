'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  applyFavoriteDelta,
  buildTogglePayload,
  type FavoriteDelta,
} from '@/lib/favorites-payload';

const QUERY_KEY = ['favorites'] as const;

type FavoritesWrite = FavoriteDelta | { op: 'replace'; codes: string[] };

const fetchFavorites = async (): Promise<string[]> => {
  const res = await fetch('/api/favorites');
  if (!res.ok) throw new Error('Failed to load favorites');
  return res.json();
};

const writeFavorites = async (payload: FavoritesWrite): Promise<void> => {
  const res = await fetch('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save favorites');
};

export const useFavorites = () => {
  const queryClient = useQueryClient();
  const { data: favorites = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFavorites,
  });

  const mutation = useMutation({
    mutationFn: writeFavorites,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData<string[]>(QUERY_KEY);
      // 單筆增刪只動自己那一筆；清單尚未載入時也不會推論出空清單。
      queryClient.setQueryData(
        QUERY_KEY,
        payload.op === 'replace' ? payload.codes : applyFavoriteDelta(prev, payload)
      );
      return { prev };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
    },
  });

  const isFavorite = useCallback(
    (code: string) => favorites.includes(code),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (code: string) => {
      const cached = queryClient.getQueryData<string[]>(QUERY_KEY);
      mutation.mutate(buildTogglePayload(code, (cached ?? []).includes(code)));
    },
    [mutation, queryClient]
  );

  /** 整份覆蓋：僅供匯入使用，會清掉現有收藏。 */
  const replaceFavorites = useCallback(
    (codes: string[]) => mutation.mutate({ op: 'replace', codes }),
    [mutation]
  );

  return { favorites, toggleFavorite, isFavorite, replaceFavorites };
};
