import { create } from "zustand";
import type {
  TasteProfile,
  CurrentPreferences,
  GameEntry,
  GameSentiment,
  OnboardingStep,
  Recommendation,
  RecommendationSession,
  UserMode,
} from "@/lib/types";
import * as guest from "@/lib/guest-storage";
import * as remote from "@/lib/supabase-storage";

interface AppState {
  // User mode
  userMode: UserMode;
  userId: string | null;
  setUserMode: (mode: UserMode, userId?: string) => void;
  remoteSyncStatus: "unknown" | "healthy" | "degraded" | "offline";
  remoteSyncTables: string[];

  // Onboarding
  onboardingStep: OnboardingStep;
  setOnboardingStep: (step: OnboardingStep) => void;

  // Taste profile
  tasteProfile: TasteProfile;
  addGame: (entry: GameEntry) => void;
  removeGame: (id: string) => void;
  updateGame: (id: string, updates: Partial<GameEntry>) => void;
  setTasteProfile: (profile: TasteProfile) => void;

  // Current preferences
  preferences: CurrentPreferences;
  setPreferences: (prefs: CurrentPreferences) => void;
  updatePreference: <K extends keyof CurrentPreferences>(
    key: K,
    value: CurrentPreferences[K]
  ) => void;

  // Recommendations
  recommendations: Recommendation[];
  setRecommendations: (recs: Recommendation[]) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;

  // Sessions
  sessions: RecommendationSession[];
  addSession: (session: RecommendationSession) => void;

  // Hydrate from localStorage (fast), then optionally from Supabase
  hydrate: () => void;

  // Reset all guest data
  resetAll: () => void;
}

const defaultPreferences: CurrentPreferences = {
  genres: [],
  moods: [],
  difficulty: "No preference",
  gameLength: "No preference",
  playerMode: "Any",
  crossplayCompatible: false,
  era: "Any era",
  timeCommitment: "Varies / No preference",
  platforms: [],
  globalComment: "",
};

function refreshRemoteMirrorForUser(userId: string) {
  const state = useAppStore.getState();
  remote.saveAllUserData(userId, {
    tasteProfile: state.tasteProfile,
    preferences: state.preferences,
    recommendations: state.recommendations,
    sessions: state.sessions,
    savedGames: guest.getSavedGames(),
    notInterested: guest.getNotInterestedTitles(),
    alreadyPlayed: guest.getAlreadyPlayedTitles(),
    steamProfile: guest.getSteamProfile(),
    onboardingStep: state.onboardingStep,
  });
}

export function refreshRemoteMirrorFromStore() {
  const { userId } = useAppStore.getState();
  if (!userId) return;
  refreshRemoteMirrorForUser(userId);
}

/** Sync a taste profile update to Supabase if the user is authenticated. */
function syncTasteProfile(profile: TasteProfile) {
  guest.saveTasteProfile(profile);
  const { userId } = useAppStore.getState();
  if (userId) {
    remote.replaceGameEntriesNormalizedRemote(userId, profile);
    refreshRemoteMirrorForUser(userId);
  }
}

function syncPreferences(prefs: CurrentPreferences) {
  guest.saveCurrentPreferences(prefs);
  const { userId } = useAppStore.getState();
  if (userId) {
    remote.savePreferencesNormalizedRemote(userId, prefs);
    refreshRemoteMirrorForUser(userId);
  }
}

/**
 * Version counter that increments on every user-initiated state mutation.
 * Used to detect whether the user changed state while a Supabase fetch
 * was in flight, so we can avoid overwriting their changes with stale data.
 */
let _stateVersion = 0;

export const useAppStore = create<AppState>((set, get) => ({
  userMode: "guest",
  userId: null,
  remoteSyncStatus: "unknown",
  remoteSyncTables: [],
  setUserMode: (mode, userId) =>
    set({
      userMode: mode,
      userId: userId ?? null,
      remoteSyncStatus: mode === "authenticated" ? "unknown" : "healthy",
      remoteSyncTables: [],
    }),

  onboardingStep: 0,
  setOnboardingStep: (step) => {
    _stateVersion++;
    set({ onboardingStep: step });
    guest.saveOnboardingStep(step);
    const { userId } = get();
    if (userId) {
      remote.saveOnboardingStepNormalizedRemote(userId, step);
      refreshRemoteMirrorForUser(userId);
    }
  },

  tasteProfile: { loved: [], liked: [], disliked: [] },
  addGame: (entry) => {
    _stateVersion++;
    const profile = { ...get().tasteProfile };
    profile[entry.sentiment] = [...profile[entry.sentiment], entry];
    set({ tasteProfile: profile });
    syncTasteProfile(profile);
  },
  removeGame: (id) => {
    _stateVersion++;
    const profile = { ...get().tasteProfile };
    for (const key of Object.keys(profile) as GameSentiment[]) {
      profile[key] = profile[key].filter((g) => g.id !== id);
    }
    set({ tasteProfile: profile });
    syncTasteProfile(profile);
  },
  updateGame: (id, updates) => {
    _stateVersion++;
    const profile = { ...get().tasteProfile };

    if (updates.sentiment) {
      // Sentiment change — move entry to the correct category
      let entry: GameEntry | undefined;
      for (const key of Object.keys(profile) as GameSentiment[]) {
        const found = profile[key].find((g) => g.id === id);
        if (found) {
          entry = found;
          profile[key] = profile[key].filter((g) => g.id !== id);
          break;
        }
      }
      if (entry) {
        profile[updates.sentiment] = [
          ...(profile[updates.sentiment] ?? []),
          { ...entry, ...updates },
        ];
      }
    } else {
      for (const key of Object.keys(profile) as GameSentiment[]) {
        profile[key] = profile[key].map((g) =>
          g.id === id ? { ...g, ...updates } : g
        );
      }
    }

    set({ tasteProfile: profile });
    syncTasteProfile(profile);
  },
  setTasteProfile: (profile) => {
    _stateVersion++;
    set({ tasteProfile: profile });
    syncTasteProfile(profile);
  },

  preferences: defaultPreferences,
  setPreferences: (prefs) => {
    _stateVersion++;
    set({ preferences: prefs });
    syncPreferences(prefs);
  },
  updatePreference: (key, value) => {
    _stateVersion++;
    const prefs = { ...get().preferences, [key]: value };
    set({ preferences: prefs });
    syncPreferences(prefs);
  },

  recommendations: [],
  setRecommendations: (recs) => {
    _stateVersion++;
    set({ recommendations: recs });
    guest.saveRecommendations(recs);
    const { userId } = get();
    if (userId) refreshRemoteMirrorForUser(userId);
  },
  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),

  sessions: [],
  addSession: (session) => {
    _stateVersion++;
    const sessions = [session, ...get().sessions].slice(0, 50);
    set({ sessions });
    guest.saveSession(session);
    const { userId } = get();
    if (userId) {
      remote.saveRecommendationSessionNormalizedRemote(userId, session).then((remoteSession) => {
        const latest = useAppStore.getState().sessions;
        const mergedSessions = remoteSession
          ? latest.map((existing) => (existing.id === session.id ? remoteSession : existing))
          : latest;

        if (remoteSession) {
          set({ sessions: mergedSessions });
          try {
            localStorage.setItem("wsipn_sessions", JSON.stringify(mergedSessions));
          } catch {
            /* ignore */
          }
        }

        refreshRemoteMirrorForUser(userId);
      });
    }
  },

  hydrate: () => {
    if (typeof window === "undefined") return;

    // 1. Instant hydrate from localStorage (always available)
    const profile = guest.getTasteProfile();
    const prefs = guest.getCurrentPreferences();
    const sessions = guest.getSessions();
    const savedGames = guest.getSavedGames();
    const notInterested = guest.getNotInterestedTitles();
    const alreadyPlayed = guest.getAlreadyPlayedTitles();
    const step = guest.getOnboardingStep();
    const recs = guest.getRecommendations();
    set({
      tasteProfile: profile,
      preferences: prefs,
      sessions,
      onboardingStep: step as OnboardingStep,
      recommendations: recs,
    });

    // 2. If authenticated, fetch from Supabase in background and merge
    const { userId } = get();
    if (userId) {
      set({ remoteSyncStatus: "unknown", remoteSyncTables: [] });

      // Snapshot the version before the async fetch so we can detect
      // whether the user mutated state while the request was in flight.
      const versionAtHydrate = _stateVersion;

      Promise.all([
        remote.fetchUserData(userId),
        remote.fetchSavedGamesRemote(userId),
        remote.fetchTitleFeedbackRemote(userId),
        remote.fetchRecommendationSessionsRemote(userId),
        remote.fetchGameEntriesRemote(userId),
        remote.fetchUserSettingsRemote(userId),
      ]).then(([
        remoteData,
        normalizedSavedGames,
        normalizedFeedback,
        normalizedSessions,
        normalizedProfile,
        normalizedSettings,
      ]) => {
        const syncStatus = remote.getRemoteSyncStatus();
        const syncTables = remote.getUnavailableRemoteTables();
        set({ remoteSyncStatus: syncStatus, remoteSyncTables: syncTables });

        if (remote.isRemotePersistenceUnavailable()) {
          return;
        }

        const remoteProfile =
          normalizedProfile.loved.length > 0 ||
          normalizedProfile.liked.length > 0 ||
          normalizedProfile.disliked.length > 0
            ? normalizedProfile
            : (remoteData?.taste_profile ?? { loved: [], liked: [], disliked: [] });
        const remoteSessions =
          normalizedSessions.length > 0
            ? normalizedSessions
            : ((remoteData?.sessions ?? []) as RecommendationSession[]);
        const remotePreferences =
          normalizedSettings?.preferences ??
          ((remoteData?.preferences as CurrentPreferences | undefined) ?? defaultPreferences);
        const remoteRecommendations =
          (remoteData?.recommendations as Recommendation[] | undefined)?.length
            ? (remoteData?.recommendations as Recommendation[])
            : (remoteSessions[0]?.recommendations ?? []);
        const remoteSavedGames =
          normalizedSavedGames.length > 0
            ? normalizedSavedGames
            : (remoteData?.saved_games ?? []);
        const remoteNotInterested =
          normalizedFeedback.notInterested.length > 0
            ? normalizedFeedback.notInterested
            : (remoteData?.not_interested ?? []);
        const remoteAlreadyPlayed =
          normalizedFeedback.alreadyPlayed.length > 0
            ? normalizedFeedback.alreadyPlayed
            : (remoteData?.already_played ?? []);
        const remoteStep = normalizedSettings?.onboarding_step ?? remoteData?.onboarding_step ?? 0;
        const remoteSteamProfile = normalizedSettings?.steam_profile ?? remoteData?.steam_profile ?? null;
        const remoteHasAnyData =
          remoteProfile.loved.length > 0 ||
          remoteProfile.liked.length > 0 ||
          remoteProfile.disliked.length > 0 ||
          remoteSessions.length > 0 ||
          remoteSavedGames.length > 0 ||
          remoteNotInterested.length > 0 ||
          remoteAlreadyPlayed.length > 0 ||
          remoteRecommendations.length > 0 ||
          remoteStep > 0;

        if (!remoteData && !remoteHasAnyData) {
          // No remote data yet — push local data to Supabase
          const steam = guest.getSteamProfile();
          remote.saveAllUserData(userId, {
            tasteProfile: profile,
            preferences: prefs,
            recommendations: recs,
            sessions,
            savedGames,
            notInterested,
            alreadyPlayed,
            steamProfile: steam,
            onboardingStep: step,
          });
          if (savedGames.length > 0) {
            remote.replaceSavedGamesNormalizedRemote(userId, savedGames);
          }
          if (notInterested.length > 0 || alreadyPlayed.length > 0) {
            remote.replaceTitleFeedbackNormalizedRemote(userId, {
              notInterested,
              alreadyPlayed,
            });
          }
          if (
            profile.loved.length > 0 ||
            profile.liked.length > 0 ||
            profile.disliked.length > 0
          ) {
            remote.replaceGameEntriesNormalizedRemote(userId, profile);
          }
          remote.savePreferencesNormalizedRemote(userId, prefs);
          remote.saveOnboardingStepNormalizedRemote(userId, step);
          if (steam) {
            remote.saveSteamProfileNormalizedRemote(userId, steam);
          }
          if (sessions.length > 0) {
            remote.replaceRecommendationSessionsNormalizedRemote(userId, sessions);
          }
          return;
        }

        if (!remoteData && remoteHasAnyData) {
          if (_stateVersion === versionAtHydrate) {
            set({
              tasteProfile: remoteProfile,
              recommendations: remoteRecommendations,
              sessions: remoteSessions,
            });
          }

          guest.saveTasteProfile(remoteProfile);
          guest.saveRecommendations(remoteRecommendations);
          try {
            localStorage.setItem("wsipn_sessions", JSON.stringify(remoteSessions));
          } catch {
            /* ignore */
          }

          const steam = guest.getSteamProfile();
          remote.saveAllUserData(userId, {
            tasteProfile: remoteProfile,
            preferences: remotePreferences,
            recommendations: remoteRecommendations,
            sessions: remoteSessions,
            savedGames: remoteSavedGames.length > 0 ? remoteSavedGames : savedGames,
            notInterested: remoteNotInterested.length > 0 ? remoteNotInterested : notInterested,
            alreadyPlayed: remoteAlreadyPlayed.length > 0 ? remoteAlreadyPlayed : alreadyPlayed,
            steamProfile: remoteSteamProfile ?? steam,
            onboardingStep: remoteStep,
          });
          return;
        }

        if (!remoteData) {
          return;
        }

        // Remote data exists — use it as source of truth if it has content
        const remoteHasGames =
          (remoteProfile.loved?.length ?? 0) +
          (remoteProfile.liked?.length ?? 0) +
          (remoteProfile.disliked?.length ?? 0) > 0;

        const localHasGames =
          profile.loved.length + profile.liked.length + profile.disliked.length > 0;

        if (remoteHasGames || remoteHasAnyData) {
          const remotePrefs = remotePreferences;
          const remoteRecs = remoteRecommendations;

          if (_stateVersion === versionAtHydrate) {
            // No user changes since hydration started — safe to apply remote data directly
            set({
              tasteProfile: remoteProfile,
              preferences: remotePrefs,
              recommendations: remoteRecs,
              sessions: remoteSessions,
              onboardingStep: remoteStep as OnboardingStep,
            });
          } else {
            // User made changes while Supabase was loading — merge carefully.
            // Prefer current (local) state for fields the user likely touched,
            // but pull in remote data for fields that still match the pre-hydrate snapshot.
            const current = get();

            set({
              tasteProfile: current.tasteProfile === profile ? remoteProfile : current.tasteProfile,
              preferences: current.preferences === prefs ? remotePrefs : current.preferences,
              recommendations: current.recommendations === recs ? remoteRecs : current.recommendations,
              sessions: current.sessions === sessions ? remoteSessions : current.sessions,
              onboardingStep: current.onboardingStep === step ? remoteStep as OnboardingStep : current.onboardingStep,
            });
          }

          // Sync remote → localStorage for offline/fast access
          guest.saveTasteProfile(remoteProfile);
          guest.saveCurrentPreferences(remotePrefs);
          guest.saveRecommendations(remoteRecs);
          guest.saveSavedGames(remoteSavedGames);
          guest.saveNotInterestedTitles(remoteNotInterested);
          guest.saveAlreadyPlayedTitles(remoteAlreadyPlayed);
          try {
            localStorage.setItem("wsipn_sessions", JSON.stringify(remoteSessions));
          } catch {
            /* ignore */
          }
          guest.saveOnboardingStep(remoteStep);
          if (remoteSteamProfile) {
            guest.saveSteamProfile(remoteSteamProfile);
          }
          if (normalizedSavedGames.length === 0 && remoteSavedGames.length > 0) {
            remote.replaceSavedGamesNormalizedRemote(userId, remoteSavedGames);
          }
          if (
            normalizedFeedback.notInterested.length === 0 &&
            normalizedFeedback.alreadyPlayed.length === 0 &&
            (remoteNotInterested.length > 0 || remoteAlreadyPlayed.length > 0)
          ) {
            remote.replaceTitleFeedbackNormalizedRemote(userId, {
              notInterested: remoteNotInterested,
              alreadyPlayed: remoteAlreadyPlayed,
            });
          }
          if (
            (normalizedProfile.loved.length +
              normalizedProfile.liked.length +
              normalizedProfile.disliked.length) === 0 &&
            remoteHasGames
          ) {
            remote.replaceGameEntriesNormalizedRemote(userId, remoteProfile);
          }
          if (normalizedSessions.length === 0 && remoteSessions.length > 0) {
            remote.replaceRecommendationSessionsNormalizedRemote(userId, remoteSessions);
          }
          if (!normalizedSettings) {
            if (remoteSteamProfile) {
              remote.saveSteamProfileNormalizedRemote(userId, remoteSteamProfile);
            }
            remote.savePreferencesNormalizedRemote(userId, remotePrefs);
            remote.saveOnboardingStepNormalizedRemote(userId, remoteStep);
          }
        } else if (localHasGames) {
          // Remote is empty but local has data — migrate local → remote
          const steam = guest.getSteamProfile();
          remote.saveAllUserData(userId, {
            tasteProfile: profile,
            preferences: prefs,
            recommendations: recs,
            sessions,
            savedGames,
            notInterested,
            alreadyPlayed,
            steamProfile: steam,
            onboardingStep: step,
          });
          remote.savePreferencesNormalizedRemote(userId, prefs);
          remote.saveOnboardingStepNormalizedRemote(userId, step);
          if (steam) {
            remote.saveSteamProfileNormalizedRemote(userId, steam);
          }
          if (savedGames.length > 0) {
            remote.replaceSavedGamesNormalizedRemote(userId, savedGames);
          }
          if (notInterested.length > 0 || alreadyPlayed.length > 0) {
            remote.replaceTitleFeedbackNormalizedRemote(userId, {
              notInterested,
              alreadyPlayed,
            });
          }
          if (localHasGames) {
            remote.replaceGameEntriesNormalizedRemote(userId, profile);
          }
          if (sessions.length > 0) {
            remote.replaceRecommendationSessionsNormalizedRemote(userId, sessions);
          }
        } else if (savedGames.length > 0 || notInterested.length > 0 || alreadyPlayed.length > 0) {
          const steam = guest.getSteamProfile();
          remote.saveAllUserData(userId, {
            tasteProfile: profile,
            preferences: prefs,
            recommendations: recs,
            sessions,
            savedGames,
            notInterested,
            alreadyPlayed,
            steamProfile: steam,
            onboardingStep: step,
          });
          remote.savePreferencesNormalizedRemote(userId, prefs);
          remote.saveOnboardingStepNormalizedRemote(userId, step);
          if (steam) {
            remote.saveSteamProfileNormalizedRemote(userId, steam);
          }
          if (savedGames.length > 0) {
            remote.replaceSavedGamesNormalizedRemote(userId, savedGames);
          }
          if (notInterested.length > 0 || alreadyPlayed.length > 0) {
            remote.replaceTitleFeedbackNormalizedRemote(userId, {
              notInterested,
              alreadyPlayed,
            });
          }
          if (sessions.length > 0) {
            remote.replaceRecommendationSessionsNormalizedRemote(userId, sessions);
          }
        }
      });
    } else {
      set({ remoteSyncStatus: "healthy", remoteSyncTables: [] });
    }
  },

  resetAll: () => {
    guest.clearGuestData();
    set({
      userMode: "guest",
      userId: null,
      remoteSyncStatus: "healthy",
      remoteSyncTables: [],
      onboardingStep: 0,
      tasteProfile: { loved: [], liked: [], disliked: [] },
      preferences: defaultPreferences,
      recommendations: [],
      isGenerating: false,
      sessions: [],
    });
  },
}));
