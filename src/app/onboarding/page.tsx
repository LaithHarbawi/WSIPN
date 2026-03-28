"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/contexts/app-store";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StepWelcome } from "@/components/onboarding/step-welcome";
import { StepTasteProfile } from "@/components/onboarding/step-taste-profile";
import { StepPreferences } from "@/components/onboarding/step-preferences";
import { StepReview } from "@/components/onboarding/step-review";
import { WsipnLogo } from "@/components/ui/wsipn-logo";
import Link from "next/link";

const STEP_LABELS = ["Welcome", "Taste Profile", "Preferences", "Review"];

export default function OnboardingPage() {
  const { onboardingStep, hydrate } = useAppStore();
  const prevStep = useRef(onboardingStep);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Scroll to top when step changes
  useEffect(() => {
    if (prevStep.current !== onboardingStep) {
      window.scrollTo({ top: 0, behavior: "instant" });
      prevStep.current = onboardingStep;
    }
  }, [onboardingStep]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-25%] left-[-10%] w-[55%] h-[55%] rounded-full bg-accent-primary/[0.025] blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-accent-secondary/[0.02] blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-5 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <WsipnLogo size={32} />
            <span className="text-base font-bold tracking-tight">What Should I Play Next?</span>
          </Link>
        </div>

        {onboardingStep > 0 && (
          <ProgressBar
            currentStep={onboardingStep - 1}
            totalSteps={3}
            labels={STEP_LABELS.slice(1)}
          />
        )}
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 px-6 pb-16 pt-2">
        {onboardingStep === 0 && <StepWelcome />}
        {onboardingStep === 1 && <StepTasteProfile />}
        {onboardingStep === 2 && <StepPreferences />}
        {onboardingStep === 3 && <StepReview />}
      </main>
    </div>
  );
}
