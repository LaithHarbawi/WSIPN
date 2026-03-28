"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { WsipnLogo } from "@/components/ui/wsipn-logo";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StepParticipants } from "@/components/group/step-participants";
import { StepSummary } from "@/components/group/step-summary";
import { StepFilters } from "@/components/group/step-filters";
import { StepResults } from "@/components/group/step-results";
import { mergeGroupTaste } from "@/lib/group-merge";
import type { GroupParticipant, GroupRecommendation, MergedGroupTaste } from "@/lib/group-merge";
import type { CurrentPreferences, TasteProfile } from "@/lib/types";

const STEP_LABELS = ["Players", "Summary", "Filters", "Results"];

const defaultPreferences: CurrentPreferences = {
  genres: [],
  moods: [],
  difficulty: "No preference",
  gameLength: "No preference",
  playerMode: "Any",
  era: "Any era",
  timeCommitment: "Varies / No preference",
  platforms: [],
  globalComment: "",
};

const emptyProfile: TasteProfile = { loved: [], liked: [], disliked: [] };

function createParticipant(index: number): GroupParticipant {
  return {
    id: `p-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    name: `Player ${index}`,
    tasteProfile: { ...emptyProfile, loved: [], liked: [], disliked: [] },
    preferences: { ...defaultPreferences, genres: [], moods: [] },
  };
}

export default function GroupPage() {
  const [step, setStep] = useState(0);
  const [participants, setParticipants] = useState<GroupParticipant[]>([
    createParticipant(1),
    createParticipant(2),
  ]);
  const [filters, setFilters] = useState<Partial<CurrentPreferences>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState<GroupRecommendation[]>([]);
  const [merged, setMerged] = useState<MergedGroupTaste | null>(null);
  const [error, setError] = useState("");

  // Warn before navigating away if participants have data
  useEffect(() => {
    const hasData = participants.some(
      (p) =>
        p.tasteProfile.loved.length > 0 ||
        p.tasteProfile.liked.length > 0 ||
        p.tasteProfile.disliked.length > 0
    );
    if (!hasData) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [participants]);

  const handleGoToSummary = () => {
    const m = mergeGroupTaste(participants);
    setMerged(m);
    setStep(1);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError("");
    setStep(3); // Show results step immediately (loading state)

    try {
      const res = await fetch("/api/recommendations/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants, filterPreferences: filters }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setRecommendations(data.recommendations);
    } catch (err) {
      console.error("Group generation failed:", err);
      setError(err instanceof Error ? err.message : "Failed to generate recommendations");
      setStep(2); // Go back to filters on error
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRestart = () => {
    setStep(0);
    setParticipants([createParticipant(1), createParticipant(2)]);
    setFilters({});
    setRecommendations([]);
    setMerged(null);
    setError("");
  };

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
            <span className="text-base font-bold tracking-tight">
              What Should I Play Next?
            </span>
          </Link>
        </div>

        {step < 3 && (
          <ProgressBar
            currentStep={step}
            totalSteps={4}
            labels={STEP_LABELS}
          />
        )}
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 px-6 pb-16 pt-2">
        <div className="max-w-2xl mx-auto">
          {error && (
            <div className="mb-4 rounded-xl bg-accent-danger/10 border border-accent-danger/20 px-4 py-3 text-sm text-accent-danger">
              {error}
            </div>
          )}

          {step === 0 && (
            <StepParticipants
              participants={participants}
              setParticipants={setParticipants}
              onNext={handleGoToSummary}
            />
          )}

          {step === 1 && merged && (
            <StepSummary
              participants={participants}
              merged={merged}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}

          {step === 2 && (
            <StepFilters
              filters={filters}
              setFilters={setFilters}
              onGenerate={handleGenerate}
              onBack={() => setStep(1)}
              isGenerating={isGenerating}
            />
          )}

          {step === 3 && (
            <>
              {isGenerating ? (
                <div className="flex flex-col items-center py-16 gap-6">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-accent opacity-10 animate-breathe" />
                    <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-accent opacity-20 animate-ping" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold text-text-primary">
                      Finding games for your group...
                    </p>
                    <p className="text-sm text-text-muted">
                      Analyzing {participants.length} taste profiles and finding common ground
                    </p>
                  </div>
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
              ) : (
                <StepResults
                  recommendations={recommendations}
                  participantNames={participants.map((p) => p.name)}
                  onRestart={handleRestart}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
