"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-accent-danger/10 flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-accent-danger" />
        </div>
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="text-sm text-text-muted">
          An unexpected error occurred. Your data is safe — try again or refresh the page.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-lg hover:brightness-110 transition-all"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
