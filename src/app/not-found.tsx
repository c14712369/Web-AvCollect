import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 text-center">
      <div className="mb-4 rounded-full bg-indigo-500/10 p-4 border border-indigo-500/20">
        <Compass className="h-8 w-8 text-indigo-400" />
      </div>
      <h1 className="text-xl font-bold text-white">找不到頁面</h1>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
      >
        回首頁
      </Link>
    </main>
  );
}
