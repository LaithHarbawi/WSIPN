"use client";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import type { CurrentPreferences } from "@/lib/types";
import {
  GENRE_OPTIONS,
  PLAYER_MODE_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/lib/types";

interface StepFiltersProps {
  filters: Partial<CurrentPreferences>;
  setFilters: (f: Partial<CurrentPreferences>) => void;
  onGenerate: () => void;
  onBack: () => void;
  isGenerating: boolean;
}

export function StepFilters({
  filters,
  setFilters,
  onGenerate,
  onBack,
  isGenerating,
}: StepFiltersProps) {
  const toggleGenre = (genre: string) => {
    const current = filters.genres ?? [];
    const next = current.includes(genre)
      ? current.filter((g) => g !== genre)
      : [...current, genre];
    setFilters({ ...filters, genres: next });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 flex items-center justify-center mx-auto">
          <SlidersHorizontal className="h-6 w-6 text-accent-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Session Filters
        </h2>
        <p className="text-text-secondary text-sm max-w-md mx-auto">
          Optional: narrow down what the group is in the mood for right now.
        </p>
      </div>

      {/* Genre filter */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-text-primary">Genres</p>
        <div className="flex flex-wrap gap-2">
          {GENRE_OPTIONS.map((genre) => (
            <Chip
              key={genre}
              label={genre}
              selected={(filters.genres ?? []).includes(genre)}
              onToggle={() => toggleGenre(genre)}
              size="sm"
            />
          ))}
        </div>
      </div>

      {/* Player mode */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-text-primary">Player Mode</p>
        <div className="flex flex-wrap gap-2">
          {PLAYER_MODE_OPTIONS.map((mode) => (
            <Chip
              key={mode}
              label={mode}
              selected={filters.playerMode === mode}
              onToggle={() =>
                setFilters({
                  ...filters,
                  playerMode: filters.playerMode === mode ? "Any" : mode,
                })
              }
              size="sm"
            />
          ))}
        </div>
      </div>

      {/* Platform */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-text-primary">Platform</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((platform) => (
            <Chip
              key={platform}
              label={platform}
              selected={filters.platform === platform}
              onToggle={() =>
                setFilters({
                  ...filters,
                  platform:
                    filters.platform === platform ? "Any platform" : platform,
                })
              }
              size="sm"
            />
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-border-subtle">
        <button
          onClick={onBack}
          className="text-sm text-text-muted hover:text-text-primary transition-colors font-medium"
        >
          &larr; Back
        </button>
        <Button size="lg" onClick={onGenerate} disabled={isGenerating}>
          <Sparkles className="h-4 w-4" />
          {isGenerating ? "Generating..." : "Find Group Games"}
        </Button>
      </div>
    </div>
  );
}
