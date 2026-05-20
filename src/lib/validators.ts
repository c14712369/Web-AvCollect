import { z } from 'zod';

export const addMovieSchema = z.object({
  url: z.string().url('必須是合法網址'),
});

export const favoritesSchema = z.array(z.string().min(1));

export type AddMovieInput = z.infer<typeof addMovieSchema>;
