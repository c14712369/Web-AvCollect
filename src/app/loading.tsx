import { GridSkeleton } from '@/components/Skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1920px]">
        <div className="mb-8 h-16 animate-pulse rounded-2xl bg-white/5" />
        <GridSkeleton />
      </div>
    </main>
  );
}
