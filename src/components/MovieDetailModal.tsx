'use client';
import type { Movie } from '@/types/av';

interface MovieDetailModalProps {
  movie: Movie | null;
  onClose: () => void;
}

export function MovieDetailModal({ movie, onClose: _onClose }: MovieDetailModalProps) {
  if (!movie) return null;
  return null;
}
