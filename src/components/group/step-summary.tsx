"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Users,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Zap,
  AlertTriangle,
} from "lucide-react";
import type { GroupParticipant, MergedGroupTaste } from "@/lib/group-merge";

interface StepSummaryProps {
  participants: GroupParticipant[];
  merged: MergedGroupTaste;
  onNext: () => void;
  onBack: () => void;
}

export function StepSummary({
  participants,
  merged,
  onNext,
  onBack,
}: StepSummaryProps) {
  const sharedFavorites = merged.scoredGames
    .filter((g) => g.score >= 4 && g.ratings.length >= 2)
    .slice(0, 6);

  const conflicts = merged.scoredGames
    .filter((g) => {
      const hasLove = g.ratings.some((r) => r.sentiment === "loved");
      const hasDislike = g.ratings.some((r) => r.sentiment === "disliked");
      return hasLove && hasDislike;
    })
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 flex items-center justify-center mx-auto">
          <Zap className="h-6 w-6 text-accent-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Group Taste Summary</h2>
        <p className="text-text-secondary text-sm max-w-md mx-auto">
          Here&apos;s how your group&apos;s tastes overlap and diverge.
        </p>
      </div>

      {/* Participants overview */}
      <Card variant="glass" padding="md">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-accent-primary" />
          {participants.length} Players
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {participants.map((p) => (
            <div
              key={p.id}
              className="p-3 rounded-xl bg-bg-tertiary/50 space-y-1.5"
            >
              <p className="text-sm font-semibold text-text-primary truncate">
                {p.name}
              </p>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                {p.tasteProfile.loved.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3 text-loved" />
                    {p.tasteProfile.loved.length}
                  </span>
                )}
                {p.tasteProfile.liked.length > 0 && (
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3 text-liked" />
                    {p.tasteProfile.liked.length}
                  </span>
                )}
                {p.tasteProfile.disliked.length > 0 && (
                  <span className="flex items-center gap-1">
                    <ThumbsDown className="h-3 w-3 text-disliked" />
                    {p.tasteProfile.disliked.length}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Shared favorites */}
      {sharedFavorites.length > 0 && (
        <Card variant="glass" padding="md">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Heart className="h-4 w-4 text-loved" />
            Shared Favorites
          </h3>
          <div className="space-y-2">
            {sharedFavorites.map((g) => (
              <div
                key={g.title}
                className="flex items-center justify-between p-2.5 rounded-xl bg-bg-tertiary/50"
              >
                <span className="text-sm font-medium text-text-primary">
                  {g.title}
                </span>
                <div className="flex items-center gap-1.5">
                  {g.ratings.map((r, i) => (
                    <span
                      key={i}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        r.sentiment === "loved"
                          ? "bg-loved/10 text-loved"
                          : r.sentiment === "liked"
                          ? "bg-liked/10 text-liked"
                          : "bg-disliked/10 text-disliked"
                      }`}
                    >
                      {r.participant}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Shared genres */}
      {merged.topGenres.length > 0 && (
        <Card variant="glass" padding="md">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Top Group Genres
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {merged.topGenres.map((genre) => (
              <span
                key={genre}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-accent-primary/8 text-accent-primary border border-accent-primary/15"
              >
                {genre}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Taste conflicts */}
      {conflicts.length > 0 && (
        <Card variant="glass" padding="md">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Taste Conflicts
          </h3>
          <p className="text-xs text-text-muted mb-3">
            These games have opposing opinions — the AI will navigate around
            these carefully.
          </p>
          <div className="space-y-2">
            {conflicts.map((g) => (
              <div
                key={g.title}
                className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/10"
              >
                <span className="text-sm font-medium text-text-primary">
                  {g.title}
                </span>
                <div className="flex items-center gap-1.5">
                  {g.ratings.map((r, i) => (
                    <span
                      key={i}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        r.sentiment === "loved"
                          ? "bg-loved/10 text-loved"
                          : r.sentiment === "liked"
                          ? "bg-liked/10 text-liked"
                          : "bg-disliked/10 text-disliked"
                      }`}
                    >
                      {r.participant}: {r.sentiment}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
        <button
          onClick={onBack}
          className="text-sm text-text-muted hover:text-text-primary transition-colors font-medium"
        >
          &larr; Back
        </button>
        <Button onClick={onNext}>Continue to Filters</Button>
      </div>
    </div>
  );
}
