'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpcomingMovieRow } from '@/lib/db/schema';

const QUERY_KEY = ['upcoming-movies'] as const;

const fetchUpcoming = async (): Promise<UpcomingMovieRow[]> => {
  const res = await fetch('/api/upcoming');
  if (!res.ok) throw new Error('Failed to load upcoming movies');
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Unknown error');
  return json.movies;
};

const deleteUpcomingApi = async (code: string): Promise<void> => {
  const res = await fetch(`/api/upcoming?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to delete');
};

export const useUpcomingMovies = (opts?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchUpcoming,
    enabled: opts?.enabled ?? true,
  });
};

export const useDeleteUpcomingMovie = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUpcomingApi,
    onSuccess: (_, code) => {
      queryClient.setQueryData<UpcomingMovieRow[]>(QUERY_KEY, (prev) =>
        prev ? prev.filter((m) => m.code !== code) : []
      );
    },
  });
};
