"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/contexts/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/ui/game-card";
import { GameSearchInput } from "@/components/ui/game-search-input";
import * as guestStorage from "@/lib/guest-storage";
import type { GameEntry, GameSentiment } from "@/lib/types";
import {
  Gamepad2,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Plus,
  Trash2,
  Sparkles,
  Settings,
  AlertTriangle,
  ChevronDown,
  Users,
  X,
} from "lucide-react";
import { WsipnLogo } from "@/components/ui/wsipn-logo";

export default function DashboardPage() {
  const router = useRouter();
  const {
    tasteProfile,
    addGame,
    removeGame,
    updateGame,
    hydrate,
    resetAll,
  } = useAppStore();
  const [savedGames, setSavedGames] = useState<guestStorage.SavedGame[]>([]);
  const [activeTab, setActiveTab] = useState<"profile" | "saved">(
    "profile"
  );
  const [addingTo, setAddingTo] = useState<GameSentiment | null>(null);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    hydrate();
    setSavedGames(guestStorage.getSavedGames());
  }, [hydrate]);

  // Reset the confirm state after 3 seconds if not confirmed
  useEffect(() => {
    if (resetConfirm) {
      const timer = setTimeout(() => setResetConfirm(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [resetConfirm]);

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
    addGame(entry);
    setAddingTo(null);
  };

  const removeSaved = (title: string) => {
    guestStorage.removeSavedGame(title);
    setSavedGames(guestStorage.getSavedGames());
  };

  const handleReset = () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    resetAll();
    router.push("/");
  };

  const totalGames =
    tasteProfile.loved.length +
    tasteProfile.liked.length +
    tasteProfile.disliked.length;

  const sentimentSections = [
    {
      key: "loved" as const,
      label: "Loved",
      icon: Heart,
      color: "text-loved",
      borderColor: "border-loved",
      bgColor: "bg-surface-loved",
    },
    {
      key: "liked" as const,
      label: "Liked",
      icon: ThumbsUp,
      color: "text-liked",
      borderColor: "border-liked",
      bgColor: "bg-surface-liked",
    },
    {
      key: "disliked" as const,
      label: "Disliked",
      icon: ThumbsDown,
      color: "text-disliked",
      borderColor: "border-disliked",
      bgColor: "bg-surface-disliked",
    },
  ];

  const tabs = [
    { key: "profile" as const, label: "Taste Profile" },
    { key: "saved" as const, label: "Play Later" },
  ];

  const stats = [
    { label: "Games Rated", value: totalGames, icon: Gamepad2 },
    { label: "Saved to Play", value: savedGames.length, icon: Bookmark },
    { label: "Loved", value: tasteProfile.loved.length, icon: Heart },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Ambient background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent-primary/[0.03] blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent-secondary/[0.025] blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] rounded-full bg-loved/[0.015] blur-[80px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <WsipnLogo size={32} />
            <span className="text-base font-bold tracking-tight">What Should I Play Next?</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/group")}
            >
              <Users className="h-3.5 w-3.5" />
              Group
            </Button>
            <Button
              size="sm"
              onClick={() => router.push("/onboarding")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              New Recommendations
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 pb-16 max-w-5xl mx-auto w-full space-y-10">
        {/* Premium hero heading */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="text-gradient">Your Library</span>
          </h1>
          <p className="text-text-secondary mt-2 text-sm sm:text-base">
            Manage your taste profile, saved games, and recommendation history.
          </p>
        </div>

        {/* Stats grid - glass cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="glass rounded-2xl border border-border-subtle shadow-card p-4 relative overflow-hidden group hover:border-border-medium transition-all duration-300"
            >
              {/* Subtle icon background */}
              <stat.icon className="absolute -bottom-2 -right-2 h-16 w-16 text-accent-primary/[0.04] group-hover:text-accent-primary/[0.07] transition-colors duration-300" />
              <div className="relative z-10">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs text-text-muted mt-1 font-medium uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Segmented tab control */}
        <div className="relative flex gap-0 glass rounded-2xl p-1.5 border border-border-subtle shadow-card">
          {/* Active indicator */}
          <div
            className="absolute top-1.5 bottom-1.5 rounded-xl bg-gradient-accent shadow-elevated transition-all duration-300 ease-out"
            style={{
              left: `calc(${tabs.findIndex((t) => t.key === activeTab) * (100 / tabs.length)}% + 6px)`,
              width: `calc(${100 / tabs.length}% - 12px)`,
            }}
          />
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative z-10 flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                activeTab === tab.key
                  ? "text-white"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            {sentimentSections.map((section) => (
              <div
                key={section.key}
                className="glass rounded-2xl border border-border-subtle shadow-card overflow-hidden"
              >
                {/* Colored left border accent */}
                <div className={`border-l-[3px] ${section.borderColor}`}>
                  {/* Section header */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <h3
                      className={`flex items-center gap-2.5 text-sm font-semibold ${section.color}`}
                    >
                      <div className={`w-7 h-7 rounded-lg ${section.bgColor} flex items-center justify-center`}>
                        <section.icon className="h-3.5 w-3.5" />
                      </div>
                      {section.label}
                      <span className="text-text-muted font-normal">
                        ({tasteProfile[section.key].length})
                      </span>
                    </h3>
                    <button
                      onClick={() =>
                        setAddingTo(
                          addingTo === section.key ? null : section.key
                        )
                      }
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
                        addingTo === section.key
                          ? "bg-accent-primary/15 text-accent-primary"
                          : "text-text-muted hover:text-accent-primary hover:bg-accent-primary/10"
                      }`}
                    >
                      {addingTo === section.key ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {addingTo === section.key ? "Cancel" : "Add"}
                    </button>
                  </div>

                  {/* Search input */}
                  {addingTo === section.key && (
                    <div className="px-5 pb-4">
                      <GameSearchInput
                        onSelect={(game) => handleAddGame(section.key, game)}
                        placeholder={`Search for a game you ${section.label.toLowerCase()}...`}
                      />
                    </div>
                  )}

                  {/* Game list */}
                  <div className="px-5 pb-4">
                    {tasteProfile[section.key].length > 0 ? (
                      <div className="space-y-2">
                        {tasteProfile[section.key].map((entry) => (
                          <GameCard
                            key={entry.id}
                            entry={entry}
                            onUpdate={updateGame}
                            onRemove={removeGame}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border-subtle py-6 text-center text-sm text-text-muted">
                        No games added yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saved Games Tab */}
        {activeTab === "saved" && (
          <div className="space-y-3">
            {savedGames.length > 0 ? (
              savedGames.map((game) => (
                <div
                  key={game.title}
                  className="glass rounded-2xl border border-border-subtle shadow-card group hover:border-border-medium hover:shadow-elevated transition-all duration-300 overflow-hidden"
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Cover art */}
                    {game.imageUrl ? (
                      <img
                        src={game.imageUrl}
                        alt=""
                        className="w-14 h-14 rounded-xl object-cover shadow-card flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-bg-tertiary flex items-center justify-center flex-shrink-0 shadow-card">
                        <Gamepad2 className="h-6 w-6 text-text-muted" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {game.title}
                      </p>
                      {game.genres?.length ? (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {game.genres.slice(0, 3).map((genre) => (
                            <span
                              key={genre}
                              className="text-[10px] font-medium uppercase tracking-wider text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-md"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {/* Hover-reveal delete button */}
                    <button
                      onClick={() => removeSaved(game.title)}
                      className="p-2.5 rounded-xl text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent-danger hover:bg-accent-danger/10 transition-all duration-200"
                      aria-label="Remove saved game"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="glass rounded-2xl border border-border-subtle shadow-card text-center py-16 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 flex items-center justify-center mx-auto">
                  <Bookmark className="h-6 w-6 text-accent-primary" />
                </div>
                <div>
                  <p className="text-text-secondary font-medium">No saved games yet</p>
                  <p className="text-text-muted text-sm mt-1">
                    Save games from your recommendations to play later.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Danger Zone - collapsed by default */}
        <div className="pt-8 border-t border-border-subtle">
          <button
            onClick={() => setShowDangerZone(!showDangerZone)}
            className="flex items-center gap-2 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Advanced
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                showDangerZone ? "rotate-180" : ""
              }`}
            />
          </button>

          {showDangerZone && (
            <div className="mt-4 rounded-2xl border border-accent-danger/20 bg-accent-danger/[0.04] p-5 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-accent-danger mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-accent-danger">
                    Reset All Data
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    This will permanently delete your taste profile, saved games, and all recommendation history.
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className={`text-xs font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
                  resetConfirm
                    ? "bg-accent-danger text-white hover:bg-accent-danger/90 shadow-card"
                    : "border border-accent-danger/30 text-accent-danger/80 hover:bg-accent-danger/10 hover:text-accent-danger"
                }`}
              >
                {resetConfirm ? "Confirm Reset - Click Again" : "Reset All Data"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
