"use client";

import { useState, useCallback, useEffect } from "react";
import {
  X,
  Download,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Clock,
  Search,
  Check,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/contexts/app-store";
import * as guestStorage from "@/lib/guest-storage";
import * as remote from "@/lib/supabase-storage";
import type { GameEntry, GameSentiment } from "@/lib/types";

interface SteamGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  playtimeHours: number;
  iconUrl: string | null;
  headerUrl: string;
}

type SortMode = "playtime" | "name";
type FilterMode = "all" | "played" | "unplayed";

interface SteamImportModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional external handler — when provided, imported entries go here instead of the global store. */
  onImport?: (entries: GameEntry[]) => void;
}

export function SteamImportModal({ open, onClose, onImport }: SteamImportModalProps) {
  const { addGame, userId } = useAppStore();
  const [steamInput, setSteamInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [games, setGames] = useState<SteamGame[]>([]);
  const [classified, setClassified] = useState<
    Record<number, GameSentiment>
  >({});
  const [searchFilter, setSearchFilter] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("playtime");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [imported, setImported] = useState(false);
  const [restoredFromCache, setRestoredFromCache] = useState(false);

  // Restore saved Steam profile on open
  useEffect(() => {
    if (!open) return;
    const saved = guestStorage.getSteamProfile();
    if (saved && games.length === 0 && !imported) {
      setSteamInput(saved.input);
      setGames(saved.games);
      setRestoredFromCache(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchLibrary = async () => {
    if (!steamInput.trim()) return;
    setLoading(true);
    setError("");
    setGames([]);
    setClassified({});
    setImported(false);
    setRestoredFromCache(false);

    try {
      const res = await fetch(
        `/api/steam/library?id=${encodeURIComponent(steamInput.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch library");
      } else {
        setGames(data.games);
        // Save Steam profile + library to localStorage + Supabase
        const steamData = {
          input: steamInput.trim(),
          steamId: data.steamId,
          games: data.games,
          fetchedAt: new Date().toISOString(),
        };
        guestStorage.saveSteamProfile(steamData);
        if (userId) remote.saveSteamProfileRemote(userId, steamData);
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const classify = useCallback(
    (appId: number, sentiment: GameSentiment) => {
      setClassified((prev) => {
        const next = { ...prev };
        if (next[appId] === sentiment) {
          delete next[appId]; // toggle off
        } else {
          next[appId] = sentiment;
        }
        return next;
      });
    },
    []
  );

  const importClassified = () => {
    const entries = Object.entries(classified);
    const builtEntries: GameEntry[] = [];
    for (const [appIdStr, sentiment] of entries) {
      const appId = Number(appIdStr);
      const game = games.find((g) => g.appId === appId);
      if (!game) continue;

      builtEntries.push({
        id: `steam-${appId}-${Date.now()}`,
        title: game.name,
        sentiment,
        imageUrl: game.headerUrl,
        hoursPlayed: game.playtimeHours || undefined,
        platform: "PC",
      });
    }

    if (onImport) {
      // External handler (e.g. group flow)
      onImport(builtEntries);
    } else {
      // Default: add to global store (solo onboarding)
      for (const entry of builtEntries) {
        addGame(entry);
      }
    }
    setImported(true);
  };

  // Filter and sort
  const filtered = games
    .filter((g) => {
      if (searchFilter) {
        if (!g.name.toLowerCase().includes(searchFilter.toLowerCase()))
          return false;
      }
      if (filterMode === "played" && g.playtimeMinutes === 0) return false;
      if (filterMode === "unplayed" && g.playtimeMinutes > 0) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "playtime") return b.playtimeMinutes - a.playtimeMinutes;
      return a.name.localeCompare(b.name);
    });

  const classifiedCount = Object.keys(classified).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-bg-secondary border border-border-subtle shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1b2838] flex items-center justify-center">
              <Download className="h-4 w-4 text-[#66c0f4]" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Import Steam Library</h2>
              <p className="text-xs text-text-muted">
                Rate your games to build your taste profile quickly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Input stage */}
          {games.length === 0 && !loading && (
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Steam Profile URL or Username
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={steamInput}
                    onChange={(e) => setSteamInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchLibrary()}
                    placeholder="https://steamcommunity.com/id/yourname"
                    className="flex-1 px-4 py-3 rounded-xl bg-bg-input border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary/60 transition-all"
                  />
                  <Button onClick={fetchLibrary} disabled={!steamInput.trim()}>
                    <Download className="h-4 w-4" />
                    Fetch
                  </Button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl bg-accent-danger/10 border border-accent-danger/20 px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-accent-danger mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-accent-danger">{error}</p>
                </div>
              )}

              <div className="rounded-xl bg-bg-tertiary/50 border border-border-subtle p-4 space-y-2">
                <p className="text-sm font-medium text-text-secondary">
                  How it works
                </p>
                <ol className="text-sm text-text-muted space-y-1.5 list-decimal list-inside">
                  <li>Paste your Steam profile URL or custom username</li>
                  <li>
                    Your profile and game details must be set to{" "}
                    <strong className="text-text-secondary">Public</strong>
                  </li>
                  <li>
                    We&apos;ll load your library — rate games with one click
                  </li>
                  <li>Import your rated games into your taste profile</li>
                </ol>
                <p className="text-xs text-text-muted pt-1">
                  To make your profile public: Steam → Settings → Privacy →
                  set &ldquo;My profile&rdquo; and &ldquo;Game details&rdquo; to
                  Public
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 text-accent-primary animate-spin" />
              <p className="text-sm text-text-muted">
                Fetching your Steam library...
              </p>
            </div>
          )}

          {/* Game list */}
          {games.length > 0 && !imported && (
            <div>
              {/* Toolbar */}
              <div className="sticky top-0 z-10 bg-bg-secondary border-b border-border-subtle px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-secondary">
                    <strong className="text-text-primary">
                      {games.length}
                    </strong>{" "}
                    games found
                    {classifiedCount > 0 && (
                      <span className="text-accent-primary">
                        {" "}
                        · {classifiedCount} rated
                      </span>
                    )}
                    {restoredFromCache && (
                      <button
                        onClick={fetchLibrary}
                        className="ml-2 text-xs text-text-muted hover:text-accent-primary transition-colors"
                      >
                        (cached — refresh?)
                      </button>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-text-muted">
                      <button
                        onClick={() => setSortMode("playtime")}
                        className={`px-2 py-1 rounded-md transition-colors ${
                          sortMode === "playtime"
                            ? "bg-bg-tertiary text-text-primary"
                            : "hover:text-text-secondary"
                        }`}
                      >
                        <Clock className="h-3 w-3 inline mr-1" />
                        Hours
                      </button>
                      <button
                        onClick={() => setSortMode("name")}
                        className={`px-2 py-1 rounded-md transition-colors ${
                          sortMode === "name"
                            ? "bg-bg-tertiary text-text-primary"
                            : "hover:text-text-secondary"
                        }`}
                      >
                        A–Z
                      </button>
                    </div>
                    <select
                      value={filterMode}
                      onChange={(e) =>
                        setFilterMode(e.target.value as FilterMode)
                      }
                      className="text-xs px-2 py-1 rounded-md bg-bg-tertiary border border-border-subtle text-text-secondary"
                    >
                      <option value="all">All games</option>
                      <option value="played">Played</option>
                      <option value="unplayed">Unplayed</option>
                    </select>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter games..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-bg-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
                  />
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3 text-loved" /> Loved
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3 text-liked" /> Liked
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsDown className="h-3 w-3 text-disliked" /> Disliked
                  </span>
                </div>
              </div>

              {/* Game rows */}
              <div className="divide-y divide-border-subtle">
                {filtered.map((game) => {
                  const sentiment = classified[game.appId];
                  return (
                    <div
                      key={game.appId}
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                        sentiment
                          ? "bg-bg-tertiary/50"
                          : "hover:bg-bg-tertiary/30"
                      }`}
                    >
                      {/* Game image */}
                      <img
                        src={game.headerUrl}
                        alt=""
                        className="w-[80px] h-[37px] rounded object-cover flex-shrink-0 bg-bg-tertiary"
                        loading="lazy"
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {game.name}
                        </p>
                        {game.playtimeHours > 0 && (
                          <p className="text-xs text-text-muted">
                            {game.playtimeHours} hrs played
                          </p>
                        )}
                      </div>

                      {/* Rating buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <RateButton
                          icon={Heart}
                          sentiment="loved"
                          active={sentiment === "loved"}
                          activeColor="text-loved bg-loved/15"
                          onClick={() => classify(game.appId, "loved")}
                        />
                        <RateButton
                          icon={ThumbsUp}
                          sentiment="liked"
                          active={sentiment === "liked"}
                          activeColor="text-liked bg-liked/15"
                          onClick={() => classify(game.appId, "liked")}
                        />
                        <RateButton
                          icon={ThumbsDown}
                          sentiment="disliked"
                          active={sentiment === "disliked"}
                          activeColor="text-disliked bg-disliked/15"
                          onClick={() => classify(game.appId, "disliked")}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-text-muted">
                  No games match your filter.
                </div>
              )}
            </div>
          )}

          {/* Success state */}
          {imported && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-accent-success/10 flex items-center justify-center">
                <Check className="h-7 w-7 text-accent-success" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">
                  {classifiedCount} games imported
                </h3>
                <p className="text-sm text-text-muted mt-1">
                  Your taste profile has been updated. You can still add
                  comments to individual games for better recommendations.
                </p>
              </div>
              <Button onClick={onClose}>Done</Button>
            </div>
          )}
        </div>

        {/* Footer with import button */}
        {games.length > 0 && !imported && (
          <div className="border-t border-border-subtle px-6 py-4 flex items-center justify-between bg-bg-secondary">
            <p className="text-sm text-text-muted">
              Skip games you don&apos;t have an opinion on — only rate what
              matters.
            </p>
            <Button
              onClick={importClassified}
              disabled={classifiedCount === 0}
            >
              Import {classifiedCount} Game{classifiedCount !== 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RateButton({
  icon: Icon,
  active,
  activeColor,
  onClick,
}: {
  icon: typeof Heart;
  sentiment: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-all ${
        active
          ? activeColor
          : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
      }`}
    >
      <Icon className="h-4 w-4" fill={active ? "currentColor" : "none"} />
    </button>
  );
}
