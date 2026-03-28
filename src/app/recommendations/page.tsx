"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SectionRow } from "@/components/ui/section-row";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { RecommendationSkeleton } from "@/components/ui/loading-skeleton";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/contexts/app-store";
import * as guestStorage from "@/lib/guest-storage";
import type { RecommendationFeedback } from "@/lib/types";
import {
  Gamepad2,
  ArrowLeft,
  RefreshCw,
  Edit3,
  Sparkles,
  AlertCircle,
  Zap,
  Shield,
  HelpCircle,
  LayoutDashboard,
  Play,
  Compass,
  Undo2,
} from "lucide-react";
import { WsipnLogo } from "@/components/ui/wsipn-logo";

export default function RecommendationsPage() {
  const router = useRouter();
  const {
    recommendations,
    isGenerating,
    tasteProfile,
    preferences,
    setIsGenerating,
    setRecommendations,
    hydrate,
  } = useAppStore();

  // Whether initial hydration from localStorage has completed
  const [hydrated, setHydrated] = useState(false);
  // Feedback state: { recId: feedbackType }
  const [feedbackMap, setFeedbackMap] = useState<Record<string, RecommendationFeedback>>({});
  // Titles the user marked "not interested" — persisted across sessions
  const [notInterestedTitles, setNotInterestedTitles] = useState<string[]>([]);
  // Error state for failed generation
  const [error, setError] = useState<string | null>(null);
  // Undo toast for "not interested"
  const [undoToast, setUndoToast] = useState<{ recId: string; rec: typeof recommendations[0] } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cumulative set of all titles shown across retries — persisted to sessionStorage
  // so it survives navigation to /onboarding and back
  const previouslyShownRef = useRef<Set<string>>(new Set());
  // Abort controller to cancel stale generation requests and prevent race conditions
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    hydrate();
    setNotInterestedTitles(guestStorage.getNotInterestedTitles());
    // Restore saved feedback from localStorage — only if IDs match current recs
    try {
      const saved = localStorage.getItem("wsipn_rec_feedback");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        const currentIds = new Set(useAppStore.getState().recommendations.map((r) => r.id));
        // Only keep feedback entries that match current recommendation IDs
        const relevant: Record<string, string> = {};
        for (const [id, fb] of Object.entries(parsed)) {
          if (currentIds.has(id)) relevant[id] = fb;
        }
        if (Object.keys(relevant).length > 0) setFeedbackMap(relevant as Record<string, RecommendationFeedback>);
      }
    } catch { /* ignore */ }
    // Restore previously shown titles from sessionStorage
    try {
      const prev = sessionStorage.getItem("wsipn_previously_shown");
      if (prev) {
        const titles: string[] = JSON.parse(prev);
        titles.forEach((t) => previouslyShownRef.current.add(t));
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, [hydrate]);

  // Track every recommendation title we've ever shown — persist to sessionStorage
  useEffect(() => {
    for (const r of recommendations) {
      previouslyShownRef.current.add(r.title);
    }
    try {
      sessionStorage.setItem(
        "wsipn_previously_shown",
        JSON.stringify([...previouslyShownRef.current])
      );
    } catch { /* ignore */ }
  }, [recommendations]);

  const saveFeedbackMap = useCallback((map: Record<string, RecommendationFeedback>) => {
    setFeedbackMap(map);
    try { localStorage.setItem("wsipn_rec_feedback", JSON.stringify(map)); } catch { /* ignore */ }
  }, []);

  const getSteamExclusions = useCallback((): string[] => {
    const steamProfile = guestStorage.getSteamProfile();
    if (!steamProfile) return [];
    return steamProfile.games
      .filter((g) => g.playtimeHours >= 5)
      .map((g) => g.name);
  }, []);

  /** Hard client-side filter: strip any not-interested games the LLM returned anyway. */
  const filterNotInterested = useCallback((recs: typeof recommendations) => {
    const niList = guestStorage.getNotInterestedTitles();
    if (niList.length === 0) return recs;
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const niNorm = niList.map(normalize);
    return recs.filter((r) => {
      const rNorm = normalize(r.title);
      return !niNorm.some((ni) => {
        if (ni === rNorm) return true;
        const shorter = ni.length <= rNorm.length ? ni : rNorm;
        const longer = ni.length > rNorm.length ? ni : rNorm;
        return shorter.length >= 8 && longer.includes(shorter);
      });
    });
  }, []);

  // Normalize types (LLM may return uppercase like "PRIMARY")
  const normalized = recommendations.map((r) => ({
    ...r,
    type: r.type.toLowerCase() as typeof r.type,
  }));

  const primary = normalized.filter((r) => r.type === "primary");
  const discovery = normalized.filter((r) => r.type === "discovery");
  const wildcards = normalized.filter((r) => r.type === "wildcard");
  const safePick = normalized.find((r) => r.type === "safe_pick");
  const surprise = normalized.find((r) => r.type === "surprise");
  const specialPicks = [safePick, surprise].filter(Boolean);

  const heroRec = primary[0];
  const remainingPrimary = primary.slice(1);

  /** Get all titles the user never wants to see (not interested + all previously shown). */
  const getExcludedTitles = useCallback((): string[] => {
    const ni = guestStorage.getNotInterestedTitles();
    const currentTitles = recommendations.map((r) => r.title);
    const allPrevious = [...previouslyShownRef.current];
    return [...new Set([...ni, ...currentTitles, ...allPrevious])];
  }, [recommendations]);

  const handleRefresh = async () => {
    // Cancel any in-flight generation request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setError(null);
    try {
      const excludedTitles = getExcludedTitles();
      const augmentedPreferences = {
        ...preferences,
        globalComment: [
          preferences.globalComment,
          excludedTitles.length > 0
            ? `Do NOT recommend any of these games (already shown or not interested): ${excludedTitles.join(", ")}. Give me completely different recommendations.`
            : "",
        ].filter(Boolean).join("\n\n"),
      };

      const res = await fetch("/api/recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasteProfile,
          preferences: augmentedPreferences,
          steamLibraryTitles: getSteamExclusions(),
          notInterestedTitles: guestStorage.getNotInterestedTitles(),
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      // Hard filter: remove not-interested + all previously shown games
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const prevNorm = [...previouslyShownRef.current].map(normalize);
      const cleaned = filterNotInterested(data.recommendations).filter((r: { title: string }) => {
        const rNorm = normalize(r.title);
        return !prevNorm.some((p) => {
          if (p === rNorm) return true;
          const shorter = p.length <= rNorm.length ? p : rNorm;
          const longer = p.length > rNorm.length ? p : rNorm;
          return shorter.length >= 8 && longer.includes(shorter);
        });
      });
      setRecommendations(cleaned);
      saveFeedbackMap({}); // Reset feedback for new recs
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("Something went wrong generating recommendations. Please try again.");
    } finally {
      if (!controller.signal.aborted) setIsGenerating(false);
    }
  };

  const handleFeedback = async (
    recId: string,
    type: RecommendationFeedback
  ) => {
    // Toggle feedback — clicking same action again clears it
    const updated = { ...feedbackMap };
    if (updated[recId] === type) {
      delete updated[recId];
    } else {
      updated[recId] = type;
    }
    saveFeedbackMap(updated);

    if (type === "save") {
      const rec = recommendations.find((r) => r.id === recId);
      if (rec) {
        guestStorage.saveGame({
          title: rec.title,
          imageUrl: rec.imageUrl,
          genres: rec.genres,
          savedAt: new Date().toISOString(),
        });
      }
    }

    if (type === "not_interested") {
      const rec = recommendations.find((r) => r.id === recId);
      if (rec) {
        // Persist to not-interested list
        guestStorage.addNotInterested(rec.title);
        setNotInterestedTitles(guestStorage.getNotInterestedTitles());
        // Immediately remove from current recommendations
        const filtered = recommendations.filter((r) => r.id !== recId);
        setRecommendations(filtered);
        // Show undo toast
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoToast({ recId, rec });
        undoTimerRef.current = setTimeout(() => setUndoToast(null), 6000);
      }
      return; // Don't proceed to more_like_this check
    }

    if (type === "more_like_this") {
      const sourceRec = recommendations.find((r) => r.id === recId);
      if (!sourceRec) return;

      // Cancel any in-flight generation request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setError(null);
      try {
        const excludedTitles = getExcludedTitles();
        const augmentedPreferences = {
          ...preferences,
          globalComment: [
            preferences.globalComment,
            `IMPORTANT: Give me more games like "${sourceRec.title}". Match its specific mechanics, feel, and what makes it special. Do NOT recommend "${sourceRec.title}" itself or any of these games: ${excludedTitles.join(", ")}.`,
          ].filter(Boolean).join("\n\n"),
        };

        const res = await fetch("/api/recommendations/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasteProfile,
            preferences: augmentedPreferences,
            steamLibraryTitles: getSteamExclusions(),
            notInterestedTitles: guestStorage.getNotInterestedTitles(),
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        // Hard filter: remove the source game + not-interested + all previously shown
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const sourceNorm = normalize(sourceRec.title);
        const prevNorm = [...previouslyShownRef.current].map(normalize);
        const cleaned = filterNotInterested(data.recommendations).filter((r: { title: string }) => {
          const rNorm = normalize(r.title);
          const fuzzyMatch = (a: string, b: string) => {
            if (a === b) return true;
            const shorter = a.length <= b.length ? a : b;
            const longer = a.length > b.length ? a : b;
            return shorter.length >= 8 && longer.includes(shorter);
          };
          if (fuzzyMatch(rNorm, sourceNorm)) return false;
          if (prevNorm.some((p) => fuzzyMatch(p, rNorm))) return false;
          return true;
        });
        setRecommendations(cleaned);
        saveFeedbackMap({}); // Reset feedback for new recs
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Something went wrong generating recommendations. Please try again.");
      } finally {
        if (!controller.signal.aborted) setIsGenerating(false);
      }
    }
  };

  const handleUndoNotInterested = useCallback(() => {
    if (!undoToast) return;
    // Remove from not-interested list
    guestStorage.removeNotInterested(undoToast.rec.title);
    setNotInterestedTitles(guestStorage.getNotInterestedTitles());
    // Restore to current recommendations
    setRecommendations([...recommendations, undoToast.rec]);
    // Clear toast
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
  }, [undoToast, recommendations, setRecommendations]);

  const scrollToDetail = useCallback((recId: string) => {
    const el = document.getElementById(`detail-${recId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const hasResults = recommendations.length > 0;

  const TYPE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    primary: { label: "Top Pick", color: "text-accent-primary", bg: "bg-accent-primary/15" },
    discovery: { label: "Hidden Gem", color: "text-emerald-400", bg: "bg-emerald-400/15" },
    wildcard: { label: "Wildcard", color: "text-accent-warm", bg: "bg-accent-warm/15" },
    safe_pick: { label: "Safe Pick", color: "text-accent-success", bg: "bg-accent-success/15" },
    surprise: { label: "Surprise", color: "text-accent-secondary", bg: "bg-accent-secondary/15" },
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent-primary/[0.03] blur-[140px]" />
        <div className="absolute bottom-[-30%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent-secondary/[0.04] blur-[140px]" />
        <div className="absolute top-[40%] right-[-20%] w-[40%] h-[40%] rounded-full bg-accent-warm/[0.02] blur-[120px]" />
      </div>

      {/* ── Refined Header ── */}
      <header className="relative z-20 px-6 py-4 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <WsipnLogo size={36} className="shadow-elevated group-hover:glow-md transition-all" />
            <span className="text-lg font-extrabold tracking-tight">What Should I Play Next?</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/onboarding")}
              className="text-text-secondary hover:text-text-primary"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit Profile
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="text-text-secondary hover:text-text-primary"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="relative z-10 flex-1 pb-32">
        {(isGenerating || !hydrated) ? (
          <div className="max-w-5xl mx-auto px-6">
            <RecommendationSkeleton />
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center py-20 space-y-6 px-6">
            <div className="w-16 h-16 rounded-2xl bg-accent-danger/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-accent-danger" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Something went wrong</h2>
              <p className="text-text-secondary max-w-md">{error}</p>
            </div>
            <Button onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        ) : !hasResults ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 space-y-6 px-6">
            <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-text-muted" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">No recommendations yet</h2>
              <p className="text-text-secondary max-w-md">
                Complete the onboarding flow to build your taste profile and get
                personalized game recommendations.
              </p>
            </div>
            <Button onClick={() => router.push("/onboarding")}>
              <ArrowLeft className="h-4 w-4" />
              Go to Onboarding
            </Button>
          </div>
        ) : (
          <div className="space-y-10">
            {/* ═══════════════════════════════════════════
                HERO SECTION — first primary recommendation
                ═══════════════════════════════════════════ */}
            {heroRec && (
              <section className="relative w-full overflow-hidden" style={{ minHeight: "480px" }}>
                {/* Background image */}
                <div className="absolute inset-0">
                  {(heroRec.screenshotUrl || heroRec.imageUrl) ? (
                    <img
                      src={heroRec.screenshotUrl || heroRec.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-bg-tertiary" />
                  )}
                  {/* Gradient overlays */}
                  <div className="absolute inset-0 bg-gradient-to-r from-bg-primary via-bg-primary/80 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/40 to-transparent" />
                  <div className="absolute inset-0 bg-bg-primary/20" />
                </div>

                {/* Hero content */}
                <div className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col justify-end h-full" style={{ minHeight: "480px" }}>
                  <div className="max-w-2xl pb-10 space-y-4">
                    {/* Badge */}
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${TYPE_BADGE[heroRec.type].bg} ${TYPE_BADGE[heroRec.type].color} backdrop-blur-sm`}>
                        <Sparkles className="h-3 w-3" />
                        {TYPE_BADGE[heroRec.type].label}
                      </span>
                      {heroRec.confidence && (
                        <span className="text-xs font-medium text-accent-primary/80">
                          {heroRec.confidence} match
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
                      {heroRec.title}
                    </h1>

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-sm text-text-secondary">
                      {heroRec.year && <span>{heroRec.year}</span>}
                      {heroRec.genres?.length ? (
                        <>
                          <span className="opacity-40">|</span>
                          <span>{heroRec.genres.slice(0, 3).join(", ")}</span>
                        </>
                      ) : null}
                      {heroRec.metacritic && (
                        <>
                          <span className="opacity-40">|</span>
                          <span className={
                            heroRec.metacritic >= 75
                              ? "text-accent-success font-semibold"
                              : heroRec.metacritic >= 50
                              ? "text-accent-warm font-semibold"
                              : "text-accent-danger font-semibold"
                          }>
                            {heroRec.metacritic} Metacritic
                          </span>
                        </>
                      )}
                    </div>

                    {/* Explanation */}
                    <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl">
                      {heroRec.explanation}
                    </p>

                    {/* Hero actions */}
                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        onClick={() => handleFeedback(heroRec.id, "save")}
                        className="shadow-elevated"
                      >
                        <Play className="h-4 w-4" />
                        Save to Play Later
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleFeedback(heroRec.id, "more_like_this")}
                        className="glass"
                      >
                        <Sparkles className="h-4 w-4" />
                        More Like This
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ═══════════════════════════════════════════
                NETFLIX-STYLE HORIZONTAL SCROLL ROWS
                ═══════════════════════════════════════════ */}
            <div className="space-y-10 max-w-7xl mx-auto px-6">
              {/* Count badge */}
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-medium">
                  <Sparkles className="h-3.5 w-3.5" />
                  {recommendations.length} games curated for you
                </div>
                {recommendations.length < 8 && recommendations.length > 0 && (
                  <p className="text-xs text-text-muted">
                    Some recommendations were filtered out during verification. Hit &quot;Let&apos;s try again&quot; for more picks.
                  </p>
                )}
              </div>

              {/* ── Top Picks Row ── */}
              {remainingPrimary.length > 0 && (
                <SectionRow
                  title="Top Picks"
                  subtitle="Our best matches for your taste profile"
                  icon={<Sparkles className="h-5 w-5 text-accent-primary" />}
                  scrollable
                >
                  {remainingPrimary.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex-shrink-0 w-[280px] group cursor-pointer"
                      onClick={() => scrollToDetail(rec.id)}
                    >
                      <div className="glass rounded-2xl overflow-hidden shadow-elevated hover:glow-md transition-all duration-300 hover:scale-[1.02]">
                        {/* Card image */}
                        <div className="relative h-40 overflow-hidden">
                          {(rec.screenshotUrl || rec.imageUrl) ? (
                            <img
                              src={rec.screenshotUrl || rec.imageUrl}
                              alt={rec.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
                              <Gamepad2 className="h-8 w-8 text-text-muted" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 to-transparent" />
                          <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${TYPE_BADGE[rec.type].bg} ${TYPE_BADGE[rec.type].color} backdrop-blur-sm`}>
                            <Sparkles className="h-2.5 w-2.5" />
                            {TYPE_BADGE[rec.type].label}
                          </span>
                        </div>
                        {/* Card body */}
                        <div className="p-4 space-y-2">
                          <h3 className="font-bold text-sm text-text-primary truncate">
                            {rec.title}
                          </h3>
                          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                            {rec.explanation}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-text-muted pt-1">
                            {rec.year && <span>{rec.year}</span>}
                            {rec.genres?.length ? (
                              <>
                                <span className="opacity-40">·</span>
                                <span>{rec.genres.slice(0, 2).join(", ")}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </SectionRow>
              )}

              {/* ── Discovery Row — Hidden Gems ── */}
              {discovery.length > 0 && (
                <SectionRow
                  title="Hidden Gems"
                  subtitle="Under the radar titles"
                  icon={<Compass className="h-5 w-5 text-emerald-400" />}
                  scrollable
                >
                  {discovery.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex-shrink-0 w-[280px] group cursor-pointer"
                      onClick={() => scrollToDetail(rec.id)}
                    >
                      <div className="glass rounded-2xl overflow-hidden shadow-elevated hover:glow-md transition-all duration-300 hover:scale-[1.02]">
                        <div className="relative h-40 overflow-hidden">
                          {(rec.screenshotUrl || rec.imageUrl) ? (
                            <img
                              src={rec.screenshotUrl || rec.imageUrl}
                              alt={rec.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
                              <Gamepad2 className="h-8 w-8 text-text-muted" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 to-transparent" />
                          <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${TYPE_BADGE["discovery"].bg} ${TYPE_BADGE["discovery"].color} backdrop-blur-sm`}>
                            <Compass className="h-2.5 w-2.5" />
                            {TYPE_BADGE["discovery"].label}
                          </span>
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="font-bold text-sm text-text-primary truncate">
                            {rec.title}
                          </h3>
                          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                            {rec.explanation}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-text-muted pt-1">
                            {rec.year && <span>{rec.year}</span>}
                            {rec.genres?.length ? (
                              <>
                                <span className="opacity-40">·</span>
                                <span>{rec.genres.slice(0, 2).join(", ")}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </SectionRow>
              )}

              {/* ── Wildcard Picks Row ── */}
              {wildcards.length > 0 && (
                <SectionRow
                  title="Wildcard Picks"
                  subtitle="Thoughtful stretches based on patterns in your taste"
                  icon={<Zap className="h-5 w-5 text-accent-warm" />}
                  scrollable
                >
                  {wildcards.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex-shrink-0 w-[280px] group cursor-pointer"
                      onClick={() => scrollToDetail(rec.id)}
                    >
                      <div className="glass rounded-2xl overflow-hidden shadow-elevated hover:glow-md transition-all duration-300 hover:scale-[1.02]">
                        <div className="relative h-40 overflow-hidden">
                          {(rec.screenshotUrl || rec.imageUrl) ? (
                            <img
                              src={rec.screenshotUrl || rec.imageUrl}
                              alt={rec.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
                              <Gamepad2 className="h-8 w-8 text-text-muted" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 to-transparent" />
                          <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${TYPE_BADGE[rec.type].bg} ${TYPE_BADGE[rec.type].color} backdrop-blur-sm`}>
                            <Zap className="h-2.5 w-2.5" />
                            {TYPE_BADGE[rec.type].label}
                          </span>
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="font-bold text-sm text-text-primary truncate">
                            {rec.title}
                          </h3>
                          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                            {rec.explanation}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-text-muted pt-1">
                            {rec.year && <span>{rec.year}</span>}
                            {rec.genres?.length ? (
                              <>
                                <span className="opacity-40">·</span>
                                <span>{rec.genres.slice(0, 2).join(", ")}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </SectionRow>
              )}

              {/* ── Special Picks Row (safe_pick + surprise) ── */}
              {specialPicks.length > 0 && (
                <SectionRow
                  title="Special Picks"
                  subtitle="A safe bet and a wildcard surprise just for you"
                  icon={<Shield className="h-5 w-5 text-accent-success" />}
                  scrollable
                >
                  {specialPicks.map((rec) => {
                    if (!rec) return null;
                    const badge = TYPE_BADGE[rec.type];
                    const BadgeIcon = rec.type === "safe_pick" ? Shield : HelpCircle;
                    return (
                      <div
                        key={rec.id}
                        className="flex-shrink-0 w-[280px] group cursor-pointer"
                        onClick={() => scrollToDetail(rec.id)}
                      >
                        <div className="glass rounded-2xl overflow-hidden shadow-elevated hover:glow-md transition-all duration-300 hover:scale-[1.02]">
                          <div className="relative h-40 overflow-hidden">
                            {(rec.screenshotUrl || rec.imageUrl) ? (
                              <img
                                src={rec.screenshotUrl || rec.imageUrl}
                                alt={rec.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
                                <Gamepad2 className="h-8 w-8 text-text-muted" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 to-transparent" />
                            <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.bg} ${badge.color} backdrop-blur-sm`}>
                              <BadgeIcon className="h-2.5 w-2.5" />
                              {badge.label}
                            </span>
                          </div>
                          <div className="p-4 space-y-2">
                            <h3 className="font-bold text-sm text-text-primary truncate">
                              {rec.title}
                            </h3>
                            <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                              {rec.explanation}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-text-muted pt-1">
                              {rec.year && <span>{rec.year}</span>}
                              {rec.genres?.length ? (
                                <>
                                  <span className="opacity-40">·</span>
                                  <span>{rec.genres.slice(0, 2).join(", ")}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </SectionRow>
              )}

              {/* ═══════════════════════════════════════════
                  FULL DETAIL CARDS — vertical list
                  ═══════════════════════════════════════════ */}
              <div className="pt-6 border-t border-border-subtle space-y-8">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold tracking-tight">All Recommendations</h2>
                  <p className="text-sm text-text-muted">
                    Detailed view with explanations and actions
                  </p>
                </div>

                {/* Hero rec full card */}
                {heroRec && (
                  <div id={`detail-${heroRec.id}`}>
                    <RecommendationCard
                      key={heroRec.id}
                      recommendation={heroRec}
                      featured
                      activeFeedback={feedbackMap[heroRec.id] ?? null}
                      onFeedback={(type) => handleFeedback(heroRec.id, type)}
                    />
                  </div>
                )}

                {/* Remaining primary */}
                {remainingPrimary.map((rec) => (
                  <div key={rec.id} id={`detail-${rec.id}`}>
                    <RecommendationCard
                      recommendation={rec}
                      activeFeedback={feedbackMap[rec.id] ?? null}
                      onFeedback={(type) => handleFeedback(rec.id, type)}
                    />
                  </div>
                ))}

                {/* Discovery */}
                {discovery.map((rec) => (
                  <div key={rec.id} id={`detail-${rec.id}`}>
                    <RecommendationCard
                      recommendation={rec}
                      activeFeedback={feedbackMap[rec.id] ?? null}
                      onFeedback={(type) => handleFeedback(rec.id, type)}
                    />
                  </div>
                ))}

                {/* Wildcards */}
                {wildcards.map((rec) => (
                  <div key={rec.id} id={`detail-${rec.id}`}>
                    <RecommendationCard
                      recommendation={rec}
                      activeFeedback={feedbackMap[rec.id] ?? null}
                      onFeedback={(type) => handleFeedback(rec.id, type)}
                    />
                  </div>
                ))}

                {/* Special picks */}
                {specialPicks.map((rec) =>
                  rec ? (
                    <div key={rec.id} id={`detail-${rec.id}`}>
                      <RecommendationCard
                        recommendation={rec}
                        activeFeedback={feedbackMap[rec.id] ?? null}
                        onFeedback={(type) => handleFeedback(rec.id, type)}
                      />
                    </div>
                  ) : null
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════════════
                UNDO TOAST — not interested
                ═══════════════════════════════════════════ */}
            {undoToast && (
              <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-bg-secondary border border-border-subtle shadow-elevated backdrop-blur-xl">
                  <span className="text-sm text-text-secondary">
                    Removed <span className="font-medium text-text-primary">{undoToast.rec.title}</span>
                  </span>
                  <button
                    onClick={handleUndoNotInterested}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-accent-primary hover:bg-accent-primary/10 transition-colors"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Undo
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════
                ACTION BAR — sticky bottom
                ═══════════════════════════════════════════ */}
            <div className="fixed bottom-0 left-0 right-0 z-30">
              <div className="bg-bg-primary/95 backdrop-blur-xl border-t border-accent-primary/20 shadow-[0_-4px_30px_rgba(0,0,0,0.4)]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    onClick={handleRefresh}
                    loading={isGenerating}
                    className="glow-md shadow-elevated px-6"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Let&apos;s try again
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => router.push("/onboarding")}
                    className="shadow-card"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit Taste Profile
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      useAppStore.getState().setOnboardingStep(1);
                      router.push("/onboarding");
                    }}
                    className="shadow-card"
                  >
                    Edit Preferences
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
