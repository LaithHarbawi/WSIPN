"use client";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export function ProgressBar({
  currentStep,
  totalSteps,
  labels,
}: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 sm:gap-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 sm:gap-3 flex-1">
            {/* Step indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`
                  flex items-center justify-center rounded-full text-xs font-bold
                  transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                  ${
                    i < currentStep
                      ? "w-7 h-7 bg-accent-primary text-white shadow-md shadow-accent-primary/20"
                      : i === currentStep
                      ? "w-8 h-8 bg-gradient-accent text-white shadow-lg shadow-accent-primary/25"
                      : "w-7 h-7 bg-bg-tertiary text-text-muted border border-border-medium"
                  }
                `}
              >
                {i < currentStep ? (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {labels && labels[i] && (
                <span
                  className={`text-[13px] font-medium hidden sm:inline transition-all duration-300 ${
                    i === currentStep
                      ? "text-text-primary"
                      : i < currentStep
                      ? "text-text-secondary"
                      : "text-text-muted"
                  }`}
                >
                  {labels[i]}
                </span>
              )}
            </div>

            {/* Connector */}
            {i < totalSteps - 1 && (
              <div className="flex-1 h-[1.5px] rounded-full bg-border-subtle overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    i < currentStep ? "w-full" : "w-0"
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
