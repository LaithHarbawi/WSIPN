"use client";

import { useState } from "react";
import {
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Monitor,
  Clock,
  ListChecks,
} from "lucide-react";
import type { GameEntry, GameSentiment, PlayStatus } from "@/lib/types";
import { PLATFORM_OPTIONS } from "@/lib/types";

interface GameCardProps {
  entry: GameEntry;
  onUpdate: (id: string, updates: Partial<GameEntry>) => void;
  onRemove: (id: string) => void;
}

const sentimentAccent: Record<GameSentiment, string> = {
  loved: "border-l-loved/60",
  liked: "border-l-liked/60",
  disliked: "border-l-disliked/60",
};

const PLAY_STATUS_OPTIONS: { value: PlayStatus; label: string }[] = [
  { value: null, label: "Not specified" },
  { value: "completed", label: "Completed" },
  { value: "playing", label: "Currently Playing" },
  { value: "dropped", label: "Dropped / Didn't Finish" },
];

export function GameCard({ entry, onUpdate, onRemove, startExpanded }: GameCardProps & { startExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(startExpanded ?? false);

  return (
    <div
      className={`
        group relative rounded-xl border border-border-subtle bg-bg-card shadow-card
        border-l-[3px] transition-all duration-200
        ${sentimentAccent[entry.sentiment]}
        ${expanded ? "shadow-elevated" : "hover:shadow-elevated hover:border-border-medium"}
      `}
    >
      <div className="flex items-center gap-3 p-3 pr-2">
        {/* Image */}
        {entry.imageUrl ? (
          <img
            src={entry.imageUrl}
            alt=""
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-bg-tertiary"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-bg-tertiary flex-shrink-0" />
        )}

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary truncate">
            {entry.title}
          </p>
          <div className="flex items-center gap-1.5">
            {entry.genres?.length ? (
              <p className="text-xs text-text-muted truncate">
                {entry.genres.join(", ")}
              </p>
            ) : null}
            {entry.comment && (
              <MessageSquare className="h-3 w-3 text-accent-primary/60 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onRemove(entry.id)}
            className="p-2 rounded-lg text-text-muted hover:text-accent-danger hover:bg-accent-danger/8 transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Inline comment prompt when collapsed and no comment */}
      {!expanded && !entry.comment && (
        <div className="px-3 pb-3 -mt-1">
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-primary/[0.04] border border-accent-primary/10 hover:bg-accent-primary/[0.07] hover:border-accent-primary/20 transition-all group/prompt"
          >
            <MessageSquare className="h-3 w-3 text-accent-primary/50 group-hover/prompt:text-accent-primary/70 transition-colors" />
            <span className="text-xs text-text-muted group-hover/prompt:text-text-secondary transition-colors">
              Add a comment — <em>why</em> did you {entry.sentiment === "loved" ? "love" : entry.sentiment === "liked" ? "like" : "dislike"} it?
            </span>
          </button>
        </div>
      )}

      {/* Expanded details — smooth grid-rows animation */}
      <div
        className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 space-y-3 border-t border-border-subtle/60 pt-3 mx-1">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <MessageSquare className="h-3 w-3" />
                Why did you{" "}
                {entry.sentiment === "loved"
                  ? "love"
                  : entry.sentiment === "liked"
                  ? "like"
                  : "dislike"}{" "}
                it?
              </label>
              <textarea
                value={entry.comment || ""}
                onChange={(e) =>
                  onUpdate(entry.id, { comment: e.target.value })
                }
                placeholder="e.g., Loved the exploration but combat got repetitive..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/40 resize-none transition-all duration-200"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <Monitor className="h-3 w-3" />
                  Platform
                </label>
                <select
                  value={entry.platform || ""}
                  onChange={(e) =>
                    onUpdate(entry.id, {
                      platform: e.target.value || undefined,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-bg-input border border-border-subtle text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 transition-all duration-200 appearance-none"
                >
                  <option value="">Not specified</option>
                  {PLATFORM_OPTIONS.map(
                    (p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="w-24 space-y-1.5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <Clock className="h-3 w-3" />
                  Hours
                </label>
                <input
                  type="number"
                  min={0}
                  value={entry.hoursPlayed ?? ""}
                  onChange={(e) =>
                    onUpdate(entry.id, {
                      hoursPlayed: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="~hrs"
                  className="w-full px-3 py-2 rounded-xl bg-bg-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <ListChecks className="h-3 w-3" />
                Play Status
              </label>
              <select
                value={entry.playStatus ?? ""}
                onChange={(e) =>
                  onUpdate(entry.id, {
                    playStatus: (e.target.value || null) as PlayStatus,
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-bg-input border border-border-subtle text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 transition-all duration-200 appearance-none"
              >
                {PLAY_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value ?? ""}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
