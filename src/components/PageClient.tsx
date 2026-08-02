'use client';

import { useState, useEffect } from 'react';
import MainPage from '@/components/MainPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function PageClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#030101] text-[#e0e0e0] flex items-center justify-center font-mono text-xs">
        <div className="flex items-center gap-2 text-cyan-400 animate-pulse">
          <span>[SYSTEM] INITIALIZING AGENT OS COGNITIVE ENVIRONMENT...</span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <MainPage />
    </ErrorBoundary>
  );
}




