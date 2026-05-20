import { listMovies } from '@/lib/db/queries';
import { HomeView } from '@/components/HomeView';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const initialMovies = await listMovies();
  return <HomeView initialMovies={initialMovies} />;
}
