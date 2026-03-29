"use client";

import Image from "next/image";
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
  label?: string;
}

export function GameSearchInput({
  onSelect,
  placeholder = "Search for a game...",
  label = "Search for a game",
}: GameSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLButtonElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listboxId = useRef(`game-search-results-${Math.random().toString(36).slice(2)}`);
  const inputId = useRef(`game-search-input-${Math.random().toString(36).slice(2)}`);

  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    // Cancel previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setIsOpen(true); // Ensure dropdown is open when results arrive
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        // Search failed — user can still type manually
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (query.length >= 2) {
      setIsSearching(true); // Show spinner immediately
    }
    debounceTimer.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, search]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [results]);

  // Scroll highlighted item into view
  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

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

  // Total selectable items: search results + manual entry (if query is non-empty)
  const totalItems = results.length + (query.trim() ? 1 : 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (!isOpen || totalItems === 0) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        addManualEntry();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex < results.length) {
        selectGame(results[highlightedIndex]);
      } else {
        addManualEntry();
      }
    }
  };

  return (
    <div className="relative">
      <label htmlFor={inputId.current} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          id={inputId.current}
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
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && query.length >= 2}
          aria-controls={listboxId.current}
          aria-activedescendant={
            isOpen && totalItems > 0
              ? `${listboxId.current}-option-${highlightedIndex}`
              : undefined
          }
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50 transition-all duration-200"
        />
        {isSearching && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted animate-spin" />
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div
          ref={dropdownRef}
          id={listboxId.current}
          role="listbox"
          aria-label="Game search results"
          className="absolute z-50 w-full mt-1.5 rounded-2xl bg-bg-secondary border border-border-subtle shadow-elevated overflow-hidden max-h-80 overflow-y-auto scrollbar-hide"
        >
          {results.map((game, index) => (
            <button
              key={game.id}
              id={`${listboxId.current}-option-${index}`}
              ref={index === highlightedIndex ? highlightedRef : undefined}
              onClick={() => selectGame(game)}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 text-left ${
                index === highlightedIndex
                  ? "bg-bg-tertiary/80"
                  : "hover:bg-bg-tertiary/80"
              }`}
            >
              {game.background_image ? (
                <Image
                  src={game.background_image}
                  alt=""
                  width={44}
                  height={44}
                  sizes="44px"
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
              id={`${listboxId.current}-option-${results.length}`}
              ref={highlightedIndex === results.length ? highlightedRef : undefined}
              onClick={addManualEntry}
              onMouseEnter={() => setHighlightedIndex(results.length)}
              role="option"
              aria-selected={highlightedIndex === results.length}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 text-left border-t border-border-subtle/60 ${
                highlightedIndex === results.length
                  ? "bg-bg-tertiary/80"
                  : "hover:bg-bg-tertiary/80"
              }`}
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

          {isSearching && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-text-muted">
              Searching...
            </div>
          )}

          {!isSearching && results.length === 0 && query.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-text-muted">
              No games found. Press Enter to add manually.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
