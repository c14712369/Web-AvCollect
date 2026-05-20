'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const QUERY_KEY = ['favorites'] as const;

const fetchFavorites = async (): Promise<string[]> => {
  const res = await fetch('/api/favorites');
  if (!res.ok) throw new Error('Failed to load favorites');
  return res.json();
};

const saveFavorites = async (codes: string[]): Promise<void> => {
  const res = await fetch('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(codes),
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
    mutationFn: saveFavorites,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData<string[]>(QUERY_KEY);
      queryClient.setQueryData(QUERY_KEY, next);
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
    },
  });

  const toggleFavorite = useCallback(
    (code: string) => {
      const current = queryClient.getQueryData<string[]>(QUERY_KEY) ?? [];
      const next = current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];
      mutation.mutate(next);
    },
    [mutation, queryClient]
  );

  const isFavorite = useCallback(
    (code: string) => favorites.includes(code),
    [favorites]
  );

  const replaceFavorites = useCallback(
    (codes: string[]) => mutation.mutate(codes),
    [mutation]
  );

  return { favorites, toggleFavorite, isFavorite, replaceFavorites };
};
