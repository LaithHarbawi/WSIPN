"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import type { GameSearchResult } from "@/lib/types";

interface GameSearchInputProps {
  onSelect: (game: {
    igdbId?: number;
    title: string;
    slug?: string;
    imageUrl?: string;
    genres?: string[];
    released?: string;
  }) => void;
  placeholder?: string;
}

export function GameSearchInput({ onSelect, placeholder = "Search for a game..." }: GameSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch {
      // Search failed — user can still type manually
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectGame = (game: GameSearchResult) => {
    onSelect({
      igdbId: game.id,
      title: game.name,
      slug: game.slug,
      imageUrl: game.background_image ?? undefined,
      genres: game.genres?.map((g) => g.name),
      released: game.released ?? undefined,
    });
    setQuery("");
    setIsOpen(false);
    setResults([]);
  };

  const addManualEntry = () => {
    if (query.trim()) {
      onSelect({ title: query.trim() });
      setQuery("");
      setIsOpen(false);
      setResults([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0) {
        selectGame(results[0]);
      } else if (query.trim()) {
        addManualEntry();
      }
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50 transition-all duration-200"
        />
        {isSearching && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted animate-spin" />
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1.5 rounded-2xl bg-bg-secondary border border-border-subtle shadow-elevated overflow-hidden max-h-80 overflow-y-auto scrollbar-hide animate-fade-in-up"
          style={{ animationDuration: "0.2s" }}
        >
          {results.map((game, i) => (
            <button
              key={game.id}
              onClick={() => selectGame(game)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-tertiary/80 transition-colors duration-150 text-left"
            >
              {game.background_image ? (
                <img
                  src={game.background_image}
                  alt=""
                  className="w-11 h-11 rounded-lg object-cover flex-shrink-0 bg-bg-tertiary"
                />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-bg-tertiary flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">
                  {game.name}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {game.released?.substring(0, 4) ?? "Unknown year"}
                  {game.genres?.length
                    ? ` · ${game.genres.map((g) => g.name).join(", ")}`
                    : ""}
                </p>
              </div>
            </button>
          ))}

          {/* Manual entry option */}
          {query.trim() && (
            <button
              onClick={addManualEntry}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-tertiary/80 transition-colors duration-150 text-left border-t border-border-subtle/60"
            >
              <div className="w-11 h-11 rounded-lg bg-accent-primary/8 flex items-center justify-center flex-shrink-0">
                <Plus className="h-4.5 w-4.5 text-accent-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Add &ldquo;{query.trim()}&rdquo;
                </p>
                <p className="text-[11px] text-text-muted">
                  Custom entry
                </p>
              </div>
            </button>
          )}

          {!isSearching && results.length === 0 && query.length >= 2 && (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No games found. Press Enter to add manually.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
