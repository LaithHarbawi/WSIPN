"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GameSearchInput } from "@/components/ui/game-search-input";
import { SteamImportModal } from "@/components/onboarding/steam-import-modal";
import {
  Users,
  Plus,
  Trash2,
  Heart,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  User,
  Download,
} from "lucide-react";
import type { GroupParticipant } from "@/lib/group-merge";
import type { GameEntry, GameSentiment, TasteProfile, CurrentPreferences } from "@/lib/types";

interface StepParticipantsProps {
  participants: GroupParticipant[];
  setParticipants: (p: GroupParticipant[]) => void;
  onNext: () => void;
}

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

export function StepParticipants({
  participants,
  setParticipants,
  onNext,
}: StepParticipantsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeSentiment, setActiveSentiment] = useState<GameSentiment>("loved");
  const [steamModalForId, setSteamModalForId] = useState<string | null>(null);

  const handleSteamImport = (participantId: string, entries: GameEntry[]) => {
    setParticipants(
      participants.map((p) => {
        if (p.id !== participantId) return p;
        const updatedProfile = { ...p.tasteProfile };
        for (const entry of entries) {
          updatedProfile[entry.sentiment] = [
            ...updatedProfile[entry.sentiment],
            entry,
          ];
        }
        return { ...p, tasteProfile: updatedProfile };
      })
    );
  };

  const addParticipant = () => {
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setParticipants([
      ...participants,
      {
        id,
        name: `Player ${participants.length + 1}`,
        tasteProfile: { ...emptyProfile, loved: [], liked: [], disliked: [] },
        preferences: { ...defaultPreferences, genres: [], moods: [] },
      },
    ]);
    setExpandedId(id);
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateName = (id: string, name: string) => {
    setParticipants(
      participants.map((p) => (p.id === id ? { ...p, name } : p))
    );
  };

  const addGame = (
    participantId: string,
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
    setParticipants(
      participants.map((p) => {
        if (p.id !== participantId) return p;
        const entry: GameEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          igdbId: game.igdbId,
          title: game.title,
          slug: game.slug,
          imageUrl: game.imageUrl,
          sentiment,
          genres: game.genres,
          released: game.released,
        };
        return {
          ...p,
          tasteProfile: {
            ...p.tasteProfile,
            [sentiment]: [...p.tasteProfile[sentiment], entry],
          },
        };
      })
    );
  };

  const removeGame = (participantId: string, gameId: string) => {
    setParticipants(
      participants.map((p) => {
        if (p.id !== participantId) return p;
        return {
          ...p,
          tasteProfile: {
            loved: p.tasteProfile.loved.filter((g) => g.id !== gameId),
            liked: p.tasteProfile.liked.filter((g) => g.id !== gameId),
            disliked: p.tasteProfile.disliked.filter((g) => g.id !== gameId),
          },
        };
      })
    );
  };

  const getGameCount = (p: GroupParticipant) =>
    p.tasteProfile.loved.length +
    p.tasteProfile.liked.length +
    p.tasteProfile.disliked.length;

  const totalGames = participants.reduce((sum, p) => sum + getGameCount(p), 0);
  const canProceed = participants.length >= 2 && totalGames >= 2;

  const sentimentTabs: {
    key: GameSentiment;
    label: string;
    icon: typeof Heart;
    color: string;
  }[] = [
    { key: "loved", label: "Loved", icon: Heart, color: "text-loved" },
    { key: "liked", label: "Liked", icon: ThumbsUp, color: "text-liked" },
    { key: "disliked", label: "Disliked", icon: ThumbsDown, color: "text-disliked" },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 flex items-center justify-center mx-auto">
          <Users className="h-6 w-6 text-accent-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Add Participants</h2>
        <p className="text-text-secondary text-sm max-w-md mx-auto">
          Add each player and their game preferences. We&apos;ll find games
          everyone can enjoy together.
        </p>
      </div>

      {/* Participant cards */}
      <div className="space-y-3">
        {participants.map((p) => {
          const isExpanded = expandedId === p.id;
          const gameCount = getGameCount(p);
          return (
            <div
              key={p.id}
              className="rounded-2xl border border-border-subtle bg-bg-card shadow-card overflow-hidden transition-all duration-200"
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-accent-primary/8 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-accent-primary" />
                </div>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateName(p.id, e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-text-primary focus:outline-none border-b border-transparent focus:border-accent-primary/40 transition-colors"
                  placeholder="Player name"
                />
                <span className="text-xs text-text-muted font-medium">
                  {gameCount} game{gameCount !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {participants.length > 2 && (
                  <button
                    onClick={() => removeParticipant(p.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-accent-danger hover:bg-accent-danger/8 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Expanded content */}
              <div
                className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isExpanded
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-3 border-t border-border-subtle/60 pt-3">
                    {/* Sentiment tabs */}
                    <div className="flex gap-1.5">
                      {sentimentTabs.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => setActiveSentiment(s.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            activeSentiment === s.key
                              ? `${s.color} bg-current/[0.08]`
                              : "text-text-muted hover:text-text-secondary"
                          }`}
                        >
                          <s.icon className="h-3 w-3" />
                          {s.label}
                          {p.tasteProfile[s.key].length > 0 && (
                            <span className="text-[10px] opacity-70">
                              ({p.tasteProfile[s.key].length})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Steam import + Search */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <GameSearchInput
                          onSelect={(game) =>
                            addGame(p.id, activeSentiment, game)
                          }
                          placeholder={`Search for a game ${p.name} ${activeSentiment}...`}
                        />
                      </div>
                      <button
                        onClick={() => setSteamModalForId(p.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1b2838] text-[#66c0f4] text-xs font-semibold hover:brightness-110 transition-all flex-shrink-0"
                        title="Import from Steam"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Steam
                      </button>
                    </div>

                    {/* Steam import modal for this participant */}
                    <SteamImportModal
                      open={steamModalForId === p.id}
                      onClose={() => setSteamModalForId(null)}
                      onImport={(entries) => {
                        handleSteamImport(p.id, entries);
                        setSteamModalForId(null);
                      }}
                    />

                    {/* Game list */}
                    {p.tasteProfile[activeSentiment].length > 0 && (
                      <div className="space-y-1.5">
                        {p.tasteProfile[activeSentiment].map((game) => (
                          <div
                            key={game.id}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg-tertiary/50 group"
                          >
                            {game.imageUrl ? (
                              <img
                                src={game.imageUrl}
                                alt=""
                                className="w-7 h-7 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded bg-bg-tertiary flex-shrink-0" />
                            )}
                            <span className="text-xs font-medium text-text-primary truncate flex-1">
                              {game.title}
                            </span>
                            <button
                              onClick={() => removeGame(p.id, game.id)}
                              className="p-1 rounded text-text-muted hover:text-accent-danger opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add participant button */}
      {participants.length < 8 && (
        <button
          onClick={addParticipant}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-border-medium text-sm font-medium text-text-muted hover:text-accent-primary hover:border-accent-primary/40 hover:bg-accent-primary/[0.03] transition-all"
        >
          <Plus className="h-4 w-4" />
          Add Player
        </button>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
        <p className="text-xs text-text-muted">
          {participants.length} player{participants.length !== 1 ? "s" : ""}{" "}
          &middot; {totalGames} total games
        </p>
        <Button onClick={onNext} disabled={!canProceed}>
          Continue
        </Button>
      </div>
    </div>
  );
}
