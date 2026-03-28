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
  era: "Any era",
  timeCommitment: "Varies / No preference",
  platforms: [],
  globalComment: "",
};

/** Sync a taste profile update to Supabase if the user is authenticated. */
function syncTasteProfile(profile: TasteProfile) {
  guest.saveTasteProfile(profile);
  const { userId } = useAppStore.getState();
  if (userId) remote.saveTasteProfileRemote(userId, profile);
}

function syncPreferences(prefs: CurrentPreferences) {
  guest.saveCurrentPreferences(prefs);
  const { userId } = useAppStore.getState();
  if (userId) remote.savePreferencesRemote(userId, prefs);
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
  setUserMode: (mode, userId) => set({ userMode: mode, userId: userId ?? null }),

  onboardingStep: 0,
  setOnboardingStep: (step) => {
    _stateVersion++;
    set({ onboardingStep: step });
    guest.saveOnboardingStep(step);
    const { userId } = get();
    if (userId) remote.saveOnboardingStepRemote(userId, step);
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
    if (userId) remote.saveRecommendationsRemote(userId, recs);
  },
  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),

  sessions: [],
  addSession: (session) => {
    _stateVersion++;
    const sessions = [session, ...get().sessions];
    set({ sessions });
    guest.saveSession(session);
    const { userId } = get();
    if (userId) remote.saveSessionsRemote(userId, sessions);
  },

  hydrate: () => {
    if (typeof window === "undefined") return;

    // 1. Instant hydrate from localStorage (always available)
    const profile = guest.getTasteProfile();
    const prefs = guest.getCurrentPreferences();
    const sessions = guest.getSessions();
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
      // Snapshot the version before the async fetch so we can detect
      // whether the user mutated state while the request was in flight.
      const versionAtHydrate = _stateVersion;

      remote.fetchUserData(userId).then((remoteData) => {
        if (!remoteData) {
          // No remote data yet — push local data to Supabase
          const steam = guest.getSteamProfile();
          remote.saveAllUserData(userId, {
            tasteProfile: profile,
            preferences: prefs,
            recommendations: recs,
            sessions,
            steamProfile: steam,
            onboardingStep: step,
          });
          return;
        }

        // Remote data exists — use it as source of truth if it has content
        const remoteProfile = remoteData.taste_profile ?? { loved: [], liked: [], disliked: [] };
        const remoteHasGames =
          (remoteProfile.loved?.length ?? 0) +
          (remoteProfile.liked?.length ?? 0) +
          (remoteProfile.disliked?.length ?? 0) > 0;

        const localHasGames =
          profile.loved.length + profile.liked.length + profile.disliked.length > 0;

        if (remoteHasGames) {
          const remotePrefs = remoteData.preferences as CurrentPreferences ?? defaultPreferences;
          const remoteRecs = (remoteData.recommendations ?? []) as Recommendation[];
          const remoteSessions = (remoteData.sessions ?? []) as RecommendationSession[];
          const remoteStep = remoteData.onboarding_step ?? 0;

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
          guest.saveOnboardingStep(remoteStep);
          if (remoteData.steam_profile) {
            guest.saveSteamProfile(remoteData.steam_profile);
          }
        } else if (localHasGames) {
          // Remote is empty but local has data — migrate local → remote
          const steam = guest.getSteamProfile();
          remote.saveAllUserData(userId, {
            tasteProfile: profile,
            preferences: prefs,
            recommendations: recs,
            sessions,
            steamProfile: steam,
            onboardingStep: step,
          });
        }
      });
    }
  },

  resetAll: () => {
    guest.clearGuestData();
    set({
      userMode: "guest",
      userId: null,
      onboardingStep: 0,
      tasteProfile: { loved: [], liked: [], disliked: [] },
      preferences: defaultPreferences,
      recommendations: [],
      isGenerating: false,
      sessions: [],
    });
  },
}));
