'use client';

import { useState, useEffect, useCallback } from 'react';

// External state to keep all hook instances in sync
let globalFavorites: string[] = [];
let isLoaded = false;
const listeners = new Set<(favs: string[]) => void>();

const syncToServer = async (next: string[]) => {
  try {
    await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    });
  } catch (e) {
    console.error('Failed to sync favorites to server', e);
  }
};

const setGlobalFavorites = (next: string[]) => {
  globalFavorites = next;
  listeners.forEach((listener) => listener(next));
  syncToServer(next);
};

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<string[]>(globalFavorites);

  useEffect(() => {
    if (!isLoaded) {
      isLoaded = true;
      fetch('/api/favorites')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            globalFavorites = data;
            setFavorites(data);
            listeners.forEach((listener) => listener(data));
          }
        })
        .catch(e => console.error('Failed to load favorites', e));
    }

    const handleChange = (next: string[]) => {
      setFavorites(next);
    };

    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  const toggleFavorite = useCallback((code: string) => {
    const next = globalFavorites.includes(code)
      ? globalFavorites.filter((c) => c !== code)
      : [...globalFavorites, code];
    setGlobalFavorites(next);
  }, []);

  const isFavorite = useCallback((code: string) => {
    return favorites.includes(code);
  }, [favorites]);

  return {
    favorites,
    toggleFavorite,
    isFavorite,
  };
};
