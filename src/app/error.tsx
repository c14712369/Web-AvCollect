'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-4 rounded-full bg-red-500/10 p-4 border border-red-500/20">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>
      <h1 className="text-xl font-bold text-white">發生錯誤</h1>
      <p className="mt-2 max-w-md text-sm text-white/40">
        {error.message || '未知錯誤'}
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
      >
        <RotateCcw className="h-4 w-4" />
        重試
      </button>
    </main>
  );
}
