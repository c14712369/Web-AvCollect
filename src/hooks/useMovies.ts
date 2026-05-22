'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Movie } from '@/types/av';

const QUERY_KEY = ['movies'] as const;

const fetchMovies = async (): Promise<Movie[]> => {
  const res = await fetch('/api/movies');
  if (!res.ok) throw new Error('Failed to load movies');
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Unknown error');
  return json.movies;
};

const deleteMovieApi = async (code: string): Promise<void> => {
  const res = await fetch(`/api/movies?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to delete');
};

const addMovie = async (url: string): Promise<Movie> => {
  const res = await fetch('/api/movies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed');
  return json.movie;
};

export const useMovies = () => {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchMovies });
};

export const useAddMovie = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addMovie,
    onSuccess: (movie) => {
      queryClient.setQueryData<Movie[]>(QUERY_KEY, (prev) =>
        prev ? [movie, ...prev] : [movie]
      );
    },
  });
};

export const useDeleteMovie = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMovieApi,
    onSuccess: (_, code) => {
      queryClient.setQueryData<Movie[]>(QUERY_KEY, (prev) =>
        prev ? prev.filter((m) => m.code !== code) : []
      );
    },
  });
};
