"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { useAppStore } from "@/contexts/app-store";
import * as guestStorage from "@/lib/guest-storage";
import {
  Heart,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Edit3,
  MessageSquare,
} from "lucide-react";
import type { GameSentiment } from "@/lib/types";

const sentimentMeta: Record<
  GameSentiment,
  { icon: typeof Heart; label: string; color: string }
> = {
  loved: { icon: Heart, label: "Loved", color: "text-loved" },
  liked: { icon: ThumbsUp, label: "Liked", color: "text-liked" },
  disliked: { icon: ThumbsDown, label: "Disliked", color: "text-disliked" },
};

export function StepReview() {
  const router = useRouter();
  const {
    tasteProfile,
    preferences,
    setOnboardingStep,
    setIsGenerating,
    setRecommendations,
  } = useAppStore();

  const [genError, setGenError] = useState<string | null>(null);

  const generateRecs = async () => {
    setGenError(null);
    setIsGenerating(true);
    router.push("/recommendations");

    // Get Steam library games with 5+ hours to exclude from recommendations
    const steamProfile = guestStorage.getSteamProfile();
    const steamLibraryTitles = steamProfile
      ? steamProfile.games
          .filter((g) => g.playtimeHours >= 5)
          .map((g) => g.name)
      : [];

    try {
      // Build cooldown-aware exclusion list
      const prefHash = guestStorage.buildPrefHash(preferences, tasteProfile);
      const cooldownTitles = guestStorage.getCooldownTitles(prefHash);
      const allNotInterested = guestStorage.getNotInterestedTitles();
      const excludeList = [...new Set([...allNotInterested, ...cooldownTitles])];

      const res = await fetch("/api/recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasteProfile,
          preferences,
          steamLibraryTitles,
          notInterestedTitles: excludeList,
        }),
      });

      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();

      // Hard filter: strip any excluded games the LLM returned anyway
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const excludeNorm = excludeList.map(normalize);
      const filtered = excludeList.length > 0
        ? (data.recommendations as Array<{ title: string }>).filter((r) => {
            const rNorm = normalize(r.title);
            return !excludeNorm.some((ex) => {
              if (ex === rNorm) return true;
              const shorter = ex.length <= rNorm.length ? ex : rNorm;
              const longer = ex.length > rNorm.length ? ex : rNorm;
              return shorter.length >= 8 && longer.includes(shorter);
            });
          })
        : data.recommendations;

      // Save recommended titles to cooldown history
      guestStorage.addToRecHistory(
        filtered.map((r: { title: string }) => r.title),
        prefHash
      );
      setRecommendations(filtered);
    } catch (error) {
      console.error("Failed to generate recommendations:", error);
      setGenError("Failed to generate recommendations. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const sentiments = ["loved", "liked", "disliked"] as const;

  const totalGames = sentiments.reduce(
    (sum, s) => sum + tasteProfile[s].length,
    0
  );

  const filteredPrefs = [
    { label: "Difficulty", value: preferences.difficulty },
    { label: "Length", value: preferences.gameLength },
    { label: "Player Mode", value: preferences.playerMode },
    { label: "Era", value: preferences.era },
    { label: "Session Time", value: preferences.timeCommitment },
    { label: "Platforms", value: preferences.platforms?.length ? preferences.platforms.join(", ") : "" },
  ].filter(
    (p) =>
      p.value &&
      p.value !== "No preference" &&
      p.value !== "Any" &&
      p.value !== "Any era" &&
      p.value !== "Varies / No preference"
  );

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-border-subtle shadow-card">
          <Sparkles className="h-4 w-4 text-accent-primary" />
          <span className="text-sm font-medium text-gradient">
            {totalGames} game{totalGames !== 1 ? "s" : ""} rated
          </span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-text-primary">
          Ready to discover?
        </h2>
        <p className="text-text-secondary max-w-md mx-auto leading-relaxed">
          Here&apos;s a summary of your taste profile and preferences.
          Let&apos;s find your next favorite game.
        </p>
      </div>

      {/* Taste Profile Summary */}
      <Card variant="glass" padding="lg" className="shadow-elevated relative overflow-hidden">
        {/* Subtle accent glow in top-left */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-accent-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-6 relative">
          <h3 className="text-lg font-semibold text-text-primary">
            Your Taste Profile
          </h3>
          <button
            onClick={() => setOnboardingStep(2)}
            className="flex items-center gap-1.5 text-sm text-accent-primary hover:text-accent-primary/80 transition-colors font-medium"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 relative">
          {sentiments.map((sentiment) => {
            const meta = sentimentMeta[sentiment];
            const games = tasteProfile[sentiment];
            if (games.length === 0) return null;
            return (
              <div key={sentiment} className="space-y-3">
                <div
                  className={`flex items-center gap-2 text-sm font-semibold ${meta.color}`}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-current/[0.08]">
                    <meta.icon className="h-3.5 w-3.5" />
                  </div>
                  {meta.label}
                  <span className="text-text-muted font-normal">
                    ({games.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {games.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-3 p-2 rounded-xl bg-bg-tertiary/50 hover:bg-bg-tertiary/80 transition-colors"
                    >
                      {g.imageUrl ? (
                        <img
                          src={g.imageUrl}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover shadow-sm flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex-shrink-0" />
                      )}
                      <span className="text-sm text-text-primary font-medium truncate">
                        {g.title}
                      </span>
                      {g.comment && (
                        <span className="text-xs text-text-muted italic truncate ml-auto flex-shrink-0 max-w-[140px]">
                          &ldquo;{g.comment}&rdquo;
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Current Preferences Summary */}
      <Card variant="glass" padding="lg" className="shadow-elevated relative overflow-hidden">
        {/* Subtle accent glow in bottom-right */}
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-accent-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-6 relative">
          <h3 className="text-lg font-semibold text-text-primary">
            Current Mood
          </h3>
          <button
            onClick={() => setOnboardingStep(1)}
            className="flex items-center gap-1.5 text-sm text-accent-primary hover:text-accent-primary/80 transition-colors font-medium"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>

        <div className="space-y-5 relative">
          {preferences.genres.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Genres
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preferences.genres.map((g) => (
                  <Chip key={g} label={g} selected size="sm" />
                ))}
              </div>
            </div>
          )}

          {preferences.moods.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Mood
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preferences.moods.map((m) => (
                  <Chip key={m} label={m} selected size="sm" />
                ))}
              </div>
            </div>
          )}

          {filteredPrefs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredPrefs.map((p) => (
                <div
                  key={p.label}
                  className="p-3 rounded-xl bg-bg-tertiary/50 space-y-0.5"
                >
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    {p.label}
                  </p>
                  <p className="text-sm text-text-primary font-medium">
                    {p.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Global Comment */}
      {preferences.globalComment?.trim() && (
        <Card variant="glass" padding="lg" className="shadow-elevated relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 relative">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent-primary" />
              <h3 className="text-lg font-semibold text-text-primary">
                Your Notes
              </h3>
            </div>
            <button
              onClick={() => setOnboardingStep(1)}
              className="flex items-center gap-1.5 text-sm text-accent-primary hover:text-accent-primary/80 transition-colors font-medium"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </button>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed italic">
            &ldquo;{preferences.globalComment.trim()}&rdquo;
          </p>
        </Card>
      )}

      {/* CTA Section */}
      <div className="flex flex-col items-center gap-4 pt-2 pb-4">
        {genError && (
          <div className="w-full max-w-md px-4 py-3 rounded-xl bg-accent-danger/10 border border-accent-danger/20 text-accent-danger text-sm text-center">
            {genError}
          </div>
        )}
        <Button
          size="xl"
          onClick={generateRecs}
          className="glow-sm w-full sm:w-auto min-w-[280px]"
        >
          <Sparkles className="h-5 w-5" />
          Generate Recommendations
        </Button>
        <button
          onClick={() => setOnboardingStep(2)}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Back to taste profile
        </button>
      </div>
    </div>
  );
}
