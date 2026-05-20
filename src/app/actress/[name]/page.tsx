import Link from 'next/link';
import { ArrowLeft, User } from 'lucide-react';
import { listMovies } from '@/lib/db/queries';
import { ActressView } from '@/components/ActressView';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ name: string }>;
}

export default async function ActressPage({ params }: PageProps) {
  const { name: encoded } = await params;
  const name = decodeURIComponent(encoded);

  const all = await listMovies();
  const works = all.filter((m) => m.actress === name);

  if (works.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 text-center">
        <div className="mb-4 rounded-full bg-white/5 p-4 border border-white/10">
          <User className="h-8 w-8 text-white/30" />
        </div>
        <h1 className="text-xl font-bold text-white">找不到女優：{name}</h1>
        <p className="mt-2 text-sm text-white/40">資料庫沒有符合此名字的作品</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          回首頁
        </Link>
      </main>
    );
  }

  return <ActressView name={name} works={works} />;
}
