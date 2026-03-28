import type {
  TasteProfile,
  CurrentPreferences,
  Recommendation,
  RecommendationSession,
  GameEntry,
  GameSentiment,
} from "./types";

const KEYS = {
  tasteProfile: "wsipn_taste_profile",
  preferences: "wsipn_preferences",
  sessions: "wsipn_sessions",
  savedGames: "wsipn_saved_games",
  onboardingStep: "wsipn_onboarding_step",
  recommendations: "wsipn_recommendations",
  steamProfile: "wsipn_steam_profile",
} as const;

const MIGRATION_KEY = "wsipn_migration_v2_done";

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setItem(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Migration: v1 → v2 (remove didnt_finish, move to disliked with playStatus: "dropped") ──

function migrateV1toV2() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  try {
    const raw = localStorage.getItem(KEYS.tasteProfile);
    if (!raw) {
      localStorage.setItem(MIGRATION_KEY, "1");
      return;
    }

    const parsed = JSON.parse(raw);
    if (parsed.didnt_finish && Array.isArray(parsed.didnt_finish)) {
      // Move didnt_finish entries to disliked with playStatus: "dropped"
      const migratedEntries = parsed.didnt_finish.map((entry: GameEntry) => ({
        ...entry,
        sentiment: "disliked" as const,
        playStatus: "dropped" as const,
      }));

      const disliked = Array.isArray(parsed.disliked) ? parsed.disliked : [];
      parsed.disliked = [...disliked, ...migratedEntries];
      delete parsed.didnt_finish;

      localStorage.setItem(KEYS.tasteProfile, JSON.stringify(parsed));
    }
  } catch {
    // Migration failed — not critical, continue with defaults
  }

  localStorage.setItem(MIGRATION_KEY, "1");
}

// Run migration on module load
migrateV1toV2();

// ── Taste Profile ──

const emptyProfile: TasteProfile = {
  loved: [],
  liked: [],
  disliked: [],
};

export function getTasteProfile(): TasteProfile {
  const profile = getItem(KEYS.tasteProfile, emptyProfile);
  // Strip any legacy didnt_finish key that might remain
  const { didnt_finish, ...clean } = profile as TasteProfile & { didnt_finish?: GameEntry[] };
  return { loved: clean.loved ?? [], liked: clean.liked ?? [], disliked: clean.disliked ?? [] };
}

export function saveTasteProfile(profile: TasteProfile) {
  setItem(KEYS.tasteProfile, profile);
}

export function addGameEntry(entry: GameEntry) {
  const profile = getTasteProfile();
  profile[entry.sentiment].push(entry);
  saveTasteProfile(profile);
}

export function removeGameEntry(id: string) {
  const profile = getTasteProfile();
  for (const key of Object.keys(profile) as GameSentiment[]) {
    profile[key] = profile[key].filter((g) => g.id !== id);
  }
  saveTasteProfile(profile);
}

export function updateGameEntry(id: string, updates: Partial<GameEntry>) {
  const profile = getTasteProfile();
  for (const key of Object.keys(profile) as GameSentiment[]) {
    profile[key] = profile[key].map((g) =>
      g.id === id ? { ...g, ...updates } : g
    );
  }
  saveTasteProfile(profile);
}

// ── Current Preferences ──

const defaultPreferences: CurrentPreferences = {
  genres: [],
  moods: [],
  difficulty: "No preference",
  gameLength: "No preference",
  playerMode: "Any",
  scope: "Any",
  era: "Any era",
  timeCommitment: "Varies / No preference",
  platform: "Any platform",
};

export function getCurrentPreferences(): CurrentPreferences {
  return getItem(KEYS.preferences, defaultPreferences);
}

export function saveCurrentPreferences(prefs: CurrentPreferences) {
  setItem(KEYS.preferences, prefs);
}

// ── Recommendation Sessions ──

export function getSessions(): RecommendationSession[] {
  return getItem(KEYS.sessions, []);
}

export function saveSession(session: RecommendationSession) {
  const sessions = getSessions();
  sessions.unshift(session);
  setItem(KEYS.sessions, sessions);
}

// ── Recommendations ──

export function getRecommendations(): Recommendation[] {
  return getItem(KEYS.recommendations, []);
}

export function saveRecommendations(recs: Recommendation[]) {
  setItem(KEYS.recommendations, recs);
}

// ── Steam Profile ──

export interface SteamProfileData {
  input: string;
  steamId: string;
  games: {
    appId: number;
    name: string;
    playtimeMinutes: number;
    playtimeHours: number;
    iconUrl: string | null;
    headerUrl: string;
  }[];
  fetchedAt: string;
}

export function getSteamProfile(): SteamProfileData | null {
  return getItem(KEYS.steamProfile, null);
}

export function saveSteamProfile(data: SteamProfileData) {
  setItem(KEYS.steamProfile, data);
}

// ── Saved Games ──

export interface SavedGame {
  title: string;
  imageUrl?: string;
  genres?: string[];
  savedAt: string;
}

export function getSavedGames(): SavedGame[] {
  return getItem(KEYS.savedGames, []);
}

export function saveGame(game: SavedGame) {
  const games = getSavedGames();
  if (!games.some((g) => g.title === game.title)) {
    games.push(game);
    setItem(KEYS.savedGames, games);
  }
}

export function removeSavedGame(title: string) {
  const games = getSavedGames().filter((g) => g.title !== title);
  setItem(KEYS.savedGames, games);
}

// ── Onboarding Step ──

export function getOnboardingStep(): number {
  return getItem(KEYS.onboardingStep, 0);
}

export function saveOnboardingStep(step: number) {
  setItem(KEYS.onboardingStep, step);
}

// ── Migration: Move all guest data for Supabase upload ──

export function exportGuestData() {
  return {
    tasteProfile: getTasteProfile(),
    preferences: getCurrentPreferences(),
    sessions: getSessions(),
    savedGames: getSavedGames(),
  };
}

export function clearGuestData() {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
