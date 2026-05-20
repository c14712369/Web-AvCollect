'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface State {
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset);
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 rounded-full bg-red-500/10 p-3 border border-red-500/20">
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
          <p className="text-sm font-medium text-white/70">{error.message}</p>
          <button
            onClick={this.reset}
            className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
