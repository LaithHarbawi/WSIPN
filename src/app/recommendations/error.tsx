"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function RecommendationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Recommendations error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-accent-danger/10 flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-accent-danger" />
        </div>
        <h2 className="text-xl font-bold">Recommendation failed</h2>
        <p className="text-sm text-text-muted">
          We couldn&apos;t load your recommendations. This is usually temporary — try generating again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-lg hover:brightness-110 transition-all"
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </button>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-semibold hover:bg-bg-tertiary/80 transition-all"
          >
            <Home className="h-4 w-4" />
            Start over
          </Link>
        </div>
      </div>
    </div>
  );
}
