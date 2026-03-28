"use client";

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl shimmer ${className}`}
    />
  );
}

export function RecommendationSkeleton() {
  return (
    <div className="space-y-10">
      {/* Pulsing indicator */}
      <div className="flex flex-col items-center py-16 gap-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-accent opacity-10 animate-breathe" />
          <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-accent opacity-20 animate-ping" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-text-primary">
            Analyzing your taste profile...
          </p>
          <p className="text-sm text-text-muted">
            Finding games that match your unique preferences
          </p>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-breathe"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      </div>

      {/* Skeleton cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border-subtle bg-bg-card p-5 shadow-card animate-fade-in-up"
            style={{ animationDelay: `${0.8 + i * 0.15}s` }}
          >
            <div className="flex gap-5">
              <LoadingSkeleton className="w-28 h-28 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-3 py-1">
                <LoadingSkeleton className="h-5 w-2/3" />
                <LoadingSkeleton className="h-3 w-2/5" />
                <div className="pt-2 space-y-2">
                  <LoadingSkeleton className="h-3 w-full" />
                  <LoadingSkeleton className="h-3 w-4/5" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GameCardSkeleton() {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-3">
      <div className="flex items-center gap-3">
        <LoadingSkeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton className="h-4 w-3/4" />
          <LoadingSkeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}
