"use client";

import Image from "next/image";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SectionRow } from "@/components/ui/section-row";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { RecommendationSkeleton } from "@/components/ui/loading-skeleton";
import { SyncStatusBanner } from "@/components/ui/sync-status-banner";
import { Button } from "@/components/ui/button";
import { refreshRemoteMirrorFromStore, useAppStore } from "@/contexts/app-store";
import * as guestStorage from "@/lib/guest-storage";
import * as remoteStorage from "@/lib/supabase-storage";
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
    userId,
    addSession,
    setIsGenerating,
    setRecommendations,
    hydrate,
  } = useAppStore();

  // Whether initial hydration from localStorage has completed
  const [hydrated, setHydrated] = useState(false);
  // Feedback state: { recId: feedbackType }
  const [feedbackMap, setFeedbackMap] = useState<Record<string, RecommendationFeedback>>({});
  // Error state for failed generation
  const [error, setError] = useState<string | null>(null);
  const [showDetailedCards, setShowDetailedCards] = useState(false);
  // Undo toast for remove-style feedback actions
  const [undoToast, setUndoToast] = useState<{
    recId: string;
    rec: typeof recommendations[0];
    action: "not_interested" | "already_played";
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cumulative set of all titles shown across retries — persisted to sessionStorage
  // so it survives navigation to /onboarding and back
  const previouslyShownRef = useRef<Set<string>>(new Set());
  // Abort controller to cancel stale generation requests and prevent race conditions
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    hydrate();
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

  // Track every recommendation title we've ever shown — persist to sessionStorage + cooldown history
  useEffect(() => {
    if (recommendations.length === 0) return;
    for (const r of recommendations) {
      previouslyShownRef.current.add(r.title);
    }
    try {
      sessionStorage.setItem(
        "wsipn_previously_shown",
        JSON.stringify([...previouslyShownRef.current])
      );
    } catch { /* ignore */ }
    // Also persist to cooldown-based rec history
    const prefHash = guestStorage.buildPrefHash(preferences, tasteProfile);
    guestStorage.addToRecHistory(recommendations.map((r) => r.title), prefHash);
  }, [recommendations, preferences, tasteProfile]);

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

  // Normalize types (LLM may return uppercase like "PRIMARY")
  const normalized = useMemo(
    () =>
      recommendations.map((r) => ({
        ...r,
        type: r.type.toLowerCase() as typeof r.type,
      })),
    [recommendations]
  );

  const primary = normalized.filter((r) => r.type === "primary");
  const discovery = normalized.filter((r) => r.type === "discovery");
  const wildcards = normalized.filter((r) => r.type === "wildcard");
  const safePick = normalized.find((r) => r.type === "safe_pick");
  const surprise = normalized.find((r) => r.type === "surprise");
  const specialPicks = [safePick, surprise].filter(Boolean);

  const heroRec = primary[0];
  const remainingPrimary = primary.slice(1);
  const detailRecommendations = useMemo(
    () => [heroRec, ...remainingPrimary, ...discovery, ...wildcards, ...specialPicks].filter(Boolean),
    [heroRec, remainingPrimary, discovery, wildcards, specialPicks]
  );

  /** Build full exclusion list: not-interested + cooldown titles + session previously shown */
  const buildExclusionList = useCallback((): string[] => {
    const ni = guestStorage.getNotInterestedTitles();
    const alreadyPlayed = guestStorage.getAlreadyPlayedTitles();
    const prefHash = guestStorage.buildPrefHash(preferences, tasteProfile);
    const cooldown = guestStorage.getCooldownTitles(prefHash);
    const sessionPrev = [...previouslyShownRef.current];
    return [...new Set([...ni, ...alreadyPlayed, ...cooldown, ...sessionPrev])];
  }, [preferences, tasteProfile]);

  /** Hard client-side filter: remove any game in the exclusion list that the LLM returned anyway */
  const hardFilterExclusions = useCallback((recs: typeof recommendations, extraExclusions: string[] = []) => {
    const allExclude = [...buildExclusionList(), ...extraExclusions];
    if (allExclude.length === 0) return recs;
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const exNorm = allExclude.map(normalize);
    return recs.filter((r) => {
      const rNorm = normalize(r.title);
      return !exNorm.some((ex) => {
        if (ex === rNorm) return true;
        const shorter = ex.length <= rNorm.length ? ex : rNorm;
        const longer = ex.length > rNorm.length ? ex : rNorm;
        return shorter.length >= 8 && longer.includes(shorter);
      });
    });
  }, [buildExclusionList]);

  const persistSession = useCallback((
    sessionPreferences: typeof preferences,
    sessionRecommendations: typeof recommendations
  ) => {
    addSession({
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      preferences: sessionPreferences,
      recommendations: sessionRecommendations,
    });
  }, [addSession]);

  const handleRefresh = async () => {
    // Cancel any in-flight generation request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setError(null);
    try {
      const allExclusions = buildExclusionList();

      const res = await fetch("/api/recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasteProfile,
          preferences,
          steamLibraryTitles: getSteamExclusions(),
          notInterestedTitles: allExclusions,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const cleaned = hardFilterExclusions(data.recommendations);
      // Save to persistent history
      const prefHash = guestStorage.buildPrefHash(preferences, tasteProfile);
      guestStorage.addToRecHistory(cleaned.map((r: { title: string }) => r.title), prefHash);
      persistSession(preferences, cleaned);
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
    const existingFeedback = feedbackMap[recId];
    // Toggle feedback — clicking same action again clears it
    const updated = { ...feedbackMap };
    if (existingFeedback === type) {
      delete updated[recId];
    } else {
      updated[recId] = type;
    }
    saveFeedbackMap(updated);

    if (type === "save") {
      const rec = recommendations.find((r) => r.id === recId);
      if (rec) {
        const savedGame = {
          title: rec.title,
          imageUrl: rec.imageUrl,
          genres: rec.genres,
          savedAt: new Date().toISOString(),
        };
        if (existingFeedback === "save") {
          guestStorage.removeSavedGame(rec.title);
          if (userId) {
            remoteStorage.removeSavedGameNormalizedRemote(userId, rec.title);
          }
        } else {
          guestStorage.saveGame(savedGame);
          if (userId) {
            remoteStorage.addSavedGameNormalizedRemote(userId, savedGame);
          }
        }
        if (userId) {
          refreshRemoteMirrorFromStore();
        }
      }
    }

    if (type === "not_interested") {
      const rec = recommendations.find((r) => r.id === recId);
      if (rec) {
        // Persist to not-interested list
        guestStorage.addNotInterested(rec.title);
        if (userId) {
          remoteStorage.addTitleFeedbackNormalizedRemote(userId, rec.title, "not_interested");
          refreshRemoteMirrorFromStore();
        }
        // Immediately remove from current recommendations
        const filtered = recommendations.filter((r) => r.id !== recId);
        setRecommendations(filtered);
        // Show undo toast
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoToast({ recId, rec, action: "not_interested" });
        undoTimerRef.current = setTimeout(() => setUndoToast(null), 6000);
      }
      return; // Don't proceed to more_like_this check
    }

    if (type === "already_played") {
      const rec = recommendations.find((r) => r.id === recId);
      if (rec) {
        guestStorage.addAlreadyPlayed(rec.title);
        if (userId) {
          remoteStorage.addTitleFeedbackNormalizedRemote(userId, rec.title, "already_played");
          refreshRemoteMirrorFromStore();
        }
        const filtered = recommendations.filter((r) => r.id !== recId);
        setRecommendations(filtered);
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoToast({ recId, rec, action: "already_played" });
        undoTimerRef.current = setTimeout(() => setUndoToast(null), 6000);
      }
      return;
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
        if (userId) {
          remoteStorage.addTitleFeedbackNormalizedRemote(
            userId,
            sourceRec.title,
            "more_like_this"
          );
        }
        const allExclusions = buildExclusionList();
        const augmentedPreferences = {
          ...preferences,
          globalComment: [
            preferences.globalComment,
            `IMPORTANT: Give me more games like "${sourceRec.title}". Match its specific mechanics, feel, and what makes it special. Do NOT recommend "${sourceRec.title}" itself.`,
          ].filter(Boolean).join("\n\n"),
        };

        const res = await fetch("/api/recommendations/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasteProfile,
            preferences: augmentedPreferences,
            steamLibraryTitles: getSteamExclusions(),
            notInterestedTitles: allExclusions,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        // Hard filter: remove source game + all exclusions
        const cleaned = hardFilterExclusions(data.recommendations, [sourceRec.title]);
        // Save to persistent history
        const prefHash = guestStorage.buildPrefHash(preferences, tasteProfile);
        guestStorage.addToRecHistory(cleaned.map((r: { title: string }) => r.title), prefHash);
        persistSession(augmentedPreferences, cleaned);
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

  const handleUndoRemoval = useCallback(() => {
    if (!undoToast) return;
    if (undoToast.action === "not_interested") {
      guestStorage.removeNotInterested(undoToast.rec.title);
      if (userId) {
        remoteStorage.removeTitleFeedbackNormalizedRemote(userId, undoToast.rec.title, "not_interested");
        refreshRemoteMirrorFromStore();
      }
    } else {
      guestStorage.removeAlreadyPlayed(undoToast.rec.title);
      if (userId) {
        remoteStorage.removeTitleFeedbackNormalizedRemote(userId, undoToast.rec.title, "already_played");
        refreshRemoteMirrorFromStore();
      }
    }
    // Restore to current recommendations
    setRecommendations([...recommendations, undoToast.rec]);
    const updated = { ...feedbackMap };
    delete updated[undoToast.recId];
    saveFeedbackMap(updated);
    // Clear toast
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
  }, [feedbackMap, recommendations, saveFeedbackMap, setRecommendations, undoToast, userId]);

  const scrollToDetail = useCallback((recId: string) => {
    if (!showDetailedCards) {
      setShowDetailedCards(true);
    }

    window.setTimeout(() => {
      const el = document.getElementById(`detail-${recId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, showDetailedCards ? 0 : 80);
  }, [showDetailedCards]);

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
      {/* Ambient background kept lighter to reduce scroll/compositing cost on Safari/WebKit */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-12%] left-[-8%] h-[34rem] w-[34rem] rounded-full bg-accent-primary/[0.025] blur-[80px]" />
        <div className="absolute right-[-8%] top-[22rem] h-[28rem] w-[28rem] rounded-full bg-accent-secondary/[0.025] blur-[72px]" />
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
            <div className="max-w-7xl mx-auto px-6">
              <SyncStatusBanner compactWhenHealthy />
            </div>

            {/* ═══════════════════════════════════════════
                HERO SECTION — first primary recommendation
                ═══════════════════════════════════════════ */}
            {heroRec && (
              <section className="relative w-full overflow-hidden" style={{ minHeight: "480px" }}>
                {/* Background image — prefer screenshot/artwork for wide hero, center on focal point */}
                <div className="absolute inset-0">
                  {(heroRec.screenshotUrl || heroRec.imageUrl) ? (
                    <Image
                      src={(heroRec.screenshotUrl || heroRec.imageUrl)!}
                      alt=""
                      fill
                      priority
                      sizes="100vw"
                      className="object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full bg-bg-tertiary" />
                  )}
                  {/* Gradient overlays — stronger to ensure text readability */}
                  <div className="absolute inset-0 bg-gradient-to-r from-bg-primary via-bg-primary/85 to-bg-primary/20" />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/50 to-transparent" />
                  <div className="absolute inset-0 bg-bg-primary/15" />
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
                      <div className="bg-gradient-card rounded-2xl overflow-hidden border border-border-subtle shadow-card transition-colors duration-200 hover:border-border-medium hover:bg-bg-card-hover">
                        {/* Card image */}
                        <div className="relative h-40 overflow-hidden">
                          {(rec.screenshotUrl || rec.imageUrl) ? (
                            <Image
                              src={(rec.screenshotUrl || rec.imageUrl)!}
                              alt={rec.title}
                              fill
                              sizes="280px"
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
                              <Gamepad2 className="h-8 w-8 text-text-muted" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 to-transparent" />
                          <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${TYPE_BADGE[rec.type].bg} ${TYPE_BADGE[rec.type].color}`}>
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
                      <div className="bg-gradient-card rounded-2xl overflow-hidden border border-border-subtle shadow-card transition-colors duration-200 hover:border-border-medium hover:bg-bg-card-hover">
                        <div className="relative h-40 overflow-hidden">
                          {(rec.screenshotUrl || rec.imageUrl) ? (
                            <Image
                              src={(rec.screenshotUrl || rec.imageUrl)!}
                              alt={rec.title}
                              fill
                              sizes="280px"
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
                              <Gamepad2 className="h-8 w-8 text-text-muted" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 to-transparent" />
                          <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${TYPE_BADGE["discovery"].bg} ${TYPE_BADGE["discovery"].color}`}>
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
                      <div className="bg-gradient-card rounded-2xl overflow-hidden border border-border-subtle shadow-card transition-colors duration-200 hover:border-border-medium hover:bg-bg-card-hover">
                        <div className="relative h-40 overflow-hidden">
                          {(rec.screenshotUrl || rec.imageUrl) ? (
                            <Image
                              src={(rec.screenshotUrl || rec.imageUrl)!}
                              alt={rec.title}
                              fill
                              sizes="280px"
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
                              <Gamepad2 className="h-8 w-8 text-text-muted" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 to-transparent" />
                          <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${TYPE_BADGE[rec.type].bg} ${TYPE_BADGE[rec.type].color}`}>
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
                        <div className="bg-gradient-card rounded-2xl overflow-hidden border border-border-subtle shadow-card transition-colors duration-200 hover:border-border-medium hover:bg-bg-card-hover">
                          <div className="relative h-40 overflow-hidden">
                            {(rec.screenshotUrl || rec.imageUrl) ? (
                              <Image
                                src={(rec.screenshotUrl || rec.imageUrl)!}
                                alt={rec.title}
                                fill
                                sizes="280px"
                                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
                                <Gamepad2 className="h-8 w-8 text-text-muted" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 to-transparent" />
                            <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${badge.bg} ${badge.color}`}>
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
              <div className="space-y-5 border-t border-border-subtle pt-6">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tight">Detailed Cards</h2>
                    <p className="text-sm text-text-muted">
                      Expand the full recommendation stack only when you want deeper reading and actions.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setShowDetailedCards((current) => !current)}
                  >
                    {showDetailedCards ? "Hide Detailed Cards" : `Show Detailed Cards (${detailRecommendations.length})`}
                  </Button>
                </div>

                {showDetailedCards ? (
                  <div className="space-y-8">
                    {detailRecommendations.map((rec, index) =>
                      rec ? (
                        <div key={rec.id} id={`detail-${rec.id}`}>
                          <RecommendationCard
                            recommendation={rec}
                            featured={index === 0}
                            activeFeedback={feedbackMap[rec.id] ?? null}
                            onFeedback={(type) => handleFeedback(rec.id, type)}
                          />
                        </div>
                      ) : null
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border-subtle bg-bg-secondary/80 px-5 py-6 text-sm text-text-secondary">
                    Keeping the heavy detail cards collapsed improves scroll performance, especially on Safari and lower-power Macs.
                  </div>
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════════════
                UNDO TOAST — remove-style feedback
                ═══════════════════════════════════════════ */}
            {undoToast && (
              <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-secondary px-5 py-3 shadow-elevated">
                  <span className="text-sm text-text-secondary">
                    {undoToast.action === "already_played" ? "Marked" : "Removed"}{" "}
                    <span className="font-medium text-text-primary">{undoToast.rec.title}</span>
                    {undoToast.action === "already_played" ? " as already played" : ""}
                  </span>
                  <button
                    onClick={handleUndoRemoval}
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
              <div className="border-t border-accent-primary/20 bg-bg-primary shadow-[0_-4px_20px_rgba(0,0,0,0.35)]">
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
