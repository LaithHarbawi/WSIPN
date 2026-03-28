"use client";

import { useState, useEffect } from "react";
import {
  Heart,
  ThumbsUp,
  ThumbsDown,
  Download,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameSearchInput } from "@/components/ui/game-search-input";
import { GameCard } from "@/components/ui/game-card";
import { CommentReminder } from "@/components/ui/comment-reminder";
import { SteamImportModal } from "@/components/onboarding/steam-import-modal";
import { useAppStore } from "@/contexts/app-store";
import type { GameSentiment, GameEntry } from "@/lib/types";

const SECTIONS: {
  key: GameSentiment;
  label: string;
  description: string;
  icon: typeof Heart;
  color: string;
  activeClasses: string;
}[] = [
  {
    key: "loved",
    label: "Loved",
    description: "All-time favorites you'd recommend to anyone",
    icon: Heart,
    color: "text-loved",
    activeClasses: "bg-loved/10 text-loved border-loved/30",
  },
  {
    key: "liked",
    label: "Liked",
    description: "Solid games you enjoyed and would play again",
    icon: ThumbsUp,
    color: "text-liked",
    activeClasses: "bg-liked/10 text-liked border-liked/30",
  },
  {
    key: "disliked",
    label: "Disliked",
    description: "Not your thing — helps us know what to avoid",
    icon: ThumbsDown,
    color: "text-disliked",
    activeClasses: "bg-disliked/10 text-disliked border-disliked/30",
  },
];

export function StepTasteProfile({ steamIdFromLogin }: { steamIdFromLogin?: string | null }) {
  const { tasteProfile, addGame, removeGame, updateGame, setOnboardingStep } =
    useAppStore();
  const [activeSection, setActiveSection] = useState<GameSentiment>("loved");
  const [steamModalOpen, setSteamModalOpen] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // Auto-open Steam modal when returning from Steam OpenID login
  useEffect(() => {
    if (steamIdFromLogin) {
      setSteamModalOpen(true);
    }
  }, [steamIdFromLogin]);

  const totalGames =
    tasteProfile.loved.length +
    tasteProfile.liked.length +
    tasteProfile.disliked.length;

  const handleAddGame = (
    sentiment: GameSentiment,
    game: {
      igdbId?: number;
      title: string;
      slug?: string;
      imageUrl?: string;
      genres?: string[];
      released?: string;
    }
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry: GameEntry = {
      id,
      igdbId: game.igdbId,
      title: game.title,
      slug: game.slug,
      imageUrl: game.imageUrl,
      sentiment,
      genres: game.genres,
      released: game.released,
    };
    addGame(entry);
    setLastAddedId(id);
  };

  const activeData = SECTIONS.find((s) => s.key === activeSection)!;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Build your taste profile
        </h2>
        <p className="text-text-secondary text-[15px]">
          Add games to each category. The more you share, the better we get.
        </p>
      </div>

      {/* Steam import */}
      <button
        onClick={() => setSteamModalOpen(true)}
        className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-[#1b2838]/80 border border-[#2a475e]/60 hover:border-[#66c0f4]/40 transition-all group shadow-card"
      >
        <div className="w-9 h-9 rounded-xl bg-[#66c0f4]/10 flex items-center justify-center flex-shrink-0">
          <Download className="h-4 w-4 text-[#66c0f4]" />
        </div>
        <div className="text-left flex-1">
          <p className="text-sm font-semibold text-[#c7d5e0] group-hover:text-white transition-colors">
            Import from Steam
          </p>
          <p className="text-xs text-[#8f98a0]">
            Bulk-rate your library in seconds
          </p>
        </div>
        <span className="text-xs text-[#8f98a0] group-hover:text-[#66c0f4] transition-colors">
          →
        </span>
      </button>

      <SteamImportModal
        open={steamModalOpen}
        onClose={() => setSteamModalOpen(false)}
        steamIdFromLogin={steamIdFromLogin}
      />

      {/* Section tabs + inline continue */}
      <div className="flex items-center gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
          {SECTIONS.map((s) => {
            const count = tasteProfile[s.key].length;
            const isActive = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold
                  transition-all duration-200 whitespace-nowrap border
                  active:scale-[0.97]
                  ${
                    isActive
                      ? s.activeClasses
                      : "text-text-muted border-transparent hover:text-text-secondary hover:bg-bg-tertiary/60"
                  }
                `}
              >
                <s.icon className={`h-3.5 w-3.5 ${isActive ? "" : ""}`} />
                {s.label}
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                      isActive
                        ? "bg-white/10"
                        : "bg-bg-tertiary text-text-muted"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {totalGames >= 1 && (
          <Button
            size="sm"
            onClick={() => setOnboardingStep(3)}
            className="flex-shrink-0"
          >
            Continue →
          </Button>
        )}
      </div>

      {/* Active section content */}
      <div className="space-y-3">
        <p className="text-[13px] text-text-muted px-0.5">
          {activeData.description}
        </p>

        <GameSearchInput
          onSelect={(game) => handleAddGame(activeSection, game)}
          placeholder={`Search for a game you ${activeData.label.toLowerCase()}...`}
        />

        {/* Comment reminder */}
        <CommentReminder tasteProfile={tasteProfile} />

        {tasteProfile[activeSection].length > 0 ? (
          <div className="space-y-2">
            {tasteProfile[activeSection].map((entry) => (
              <GameCard
                key={entry.id}
                entry={entry}
                onUpdate={updateGame}
                onRemove={removeGame}
                startExpanded={entry.id === lastAddedId}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border-medium py-10 text-center">
            <p className="text-sm text-text-muted">
              No games added yet. Search above to get started.
            </p>
          </div>
        )}
      </div>

      {/* Liked games encouragement */}
      {tasteProfile.loved.length >= 1 && tasteProfile.liked.length === 0 && activeSection !== "liked" && (
        <div className="rounded-2xl bg-liked/5 border border-liked/15 px-5 py-3.5 flex items-center gap-3">
          <ThumbsUp className="h-4 w-4 text-liked flex-shrink-0" />
          <p className="text-sm text-text-secondary leading-relaxed flex-1">
            <strong className="text-text-primary font-medium">Tip:</strong> Adding &ldquo;Liked&rdquo; games helps us distinguish between your favorites and games you simply enjoyed. This improves recommendation accuracy.
          </p>
          <button
            onClick={() => setActiveSection("liked")}
            className="text-xs font-semibold text-liked hover:text-liked/80 transition-colors whitespace-nowrap"
          >
            Add liked →
          </button>
        </div>
      )}

      {/* Skippable notice */}
      {totalGames === 0 && (
        <div className="rounded-2xl bg-accent-primary/5 border border-accent-primary/15 px-5 py-3.5 flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-accent-primary flex-shrink-0" />
          <p className="text-sm text-text-secondary leading-relaxed flex-1">
            <strong className="text-text-primary font-medium">Highly recommended:</strong> Adding games you love and dislike dramatically improves your recommendations. You can skip this, but results will be more generic.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-border-subtle">
        <button
          onClick={() => setOnboardingStep(1)}
          className="text-sm text-text-muted hover:text-text-primary transition-colors font-medium"
        >
          ← Back
        </button>
        <div className="flex items-center gap-4">
          {totalGames > 0 && (
            <span className="text-[13px] text-text-muted font-medium">
              {totalGames} game{totalGames !== 1 ? "s" : ""} added
            </span>
          )}
          {totalGames === 0 ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOnboardingStep(3)}
                className="text-sm text-text-muted hover:text-text-primary transition-colors font-medium px-3 py-2 rounded-lg hover:bg-surface-hover"
              >
                Skip for now
              </button>
            </div>
          ) : (
            <Button onClick={() => setOnboardingStep(3)}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
