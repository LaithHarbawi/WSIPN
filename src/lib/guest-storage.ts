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
  notInterested: "wsipn_not_interested",
  recHistory: "wsipn_rec_history",
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

  // If sentiment is changing, move the entry to the correct category
  if (updates.sentiment) {
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
      profile[updates.sentiment].push({ ...entry, ...updates });
    }
  } else {
    // No sentiment change — update in place
    for (const key of Object.keys(profile) as GameSentiment[]) {
      profile[key] = profile[key].map((g) =>
        g.id === id ? { ...g, ...updates } : g
      );
    }
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
  era: "Any era",
  timeCommitment: "Varies / No preference",
  platforms: [],
  globalComment: "",
};

export function getCurrentPreferences(): CurrentPreferences {
  const stored = getItem(KEYS.preferences, defaultPreferences);
  // Migrate old schema: platform (string) → platforms (array), remove scope, add globalComment
  const migrated = { ...defaultPreferences, ...stored } as CurrentPreferences & { platform?: string; scope?: string };
  if (!Array.isArray(migrated.platforms)) {
    migrated.platforms = migrated.platform && migrated.platform !== "Any platform"
      ? [migrated.platform]
      : [];
  }
  if (typeof migrated.globalComment !== "string") {
    migrated.globalComment = "";
  }
  delete migrated.platform;
  delete migrated.scope;
  return migrated;
}

export function saveCurrentPreferences(prefs: CurrentPreferences) {
  setItem(KEYS.preferences, prefs);
}

// ── Recommendation Sessions ──

export function getSessions(): RecommendationSession[] {
  return getItem(KEYS.sessions, []);
}

const MAX_SESSIONS = 50;

export function saveSession(session: RecommendationSession) {
  const sessions = getSessions();
  sessions.unshift(session);
  setItem(KEYS.sessions, sessions.slice(0, MAX_SESSIONS));
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

// ── Not Interested ──

export function getNotInterestedTitles(): string[] {
  return getItem(KEYS.notInterested, []);
}

export function addNotInterested(title: string) {
  const list = getNotInterestedTitles();
  const normalized = title.toLowerCase();
  if (!list.some((t) => t.toLowerCase() === normalized)) {
    list.push(title);
    setItem(KEYS.notInterested, list);
  }
}

export function removeNotInterested(title: string) {
  const normalized = title.toLowerCase();
  const list = getNotInterestedTitles().filter((t) => t.toLowerCase() !== normalized);
  setItem(KEYS.notInterested, list);
}

// ── Recommendation History (cooldown-based — prevents short-term repeats) ──
// Games are on cooldown for COOLDOWN_DAYS unless the user changes their preferences,
// which generates a different prefHash and makes all old recs eligible again.

export interface RecHistoryEntry {
  title: string;
  recommendedAt: number;  // timestamp
  prefHash: string;       // hash of preferences when recommended
}

const MAX_REC_HISTORY = 200;
const COOLDOWN_DAYS = 3;

/** Simple deterministic hash of preference + taste profile state */
export function buildPrefHash(
  prefs: CurrentPreferences,
  profile: TasteProfile
): string {
  const parts = [
    prefs.genres.sort().join(","),
    prefs.moods.sort().join(","),
    prefs.difficulty,
    prefs.gameLength,
    prefs.playerMode,
    prefs.era,
    prefs.timeCommitment,
    (prefs.platforms ?? []).sort().join(","),
    // Include game titles so adding/removing games changes the hash
    [...profile.loved, ...profile.liked, ...profile.disliked]
      .map((g) => g.title.toLowerCase())
      .sort()
      .join(","),
  ];
  // Simple hash — not cryptographic, just needs to detect changes
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

export function getRecHistory(): RecHistoryEntry[] {
  return getItem(KEYS.recHistory, []);
}

/** Get titles currently on cooldown (same prefHash + within cooldown window) */
export function getCooldownTitles(currentPrefHash: string): string[] {
  const entries = getRecHistory();
  const now = Date.now();
  const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return entries
    .filter((e) => e.prefHash === currentPrefHash && (now - e.recommendedAt) < cooldownMs)
    .map((e) => e.title);
}

export function addToRecHistory(titles: string[], prefHash: string) {
  const existing = getRecHistory();
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const existingNorm = new Set(existing.map((e) => normalize(e.title)));
  const now = Date.now();
  const newEntries: RecHistoryEntry[] = titles
    .filter((t) => !existingNorm.has(normalize(t)))
    .map((title) => ({ title, recommendedAt: now, prefHash }));
  if (newEntries.length === 0) {
    // Update timestamps for re-recommended games (same prefHash)
    const updated = existing.map((e) => {
      const eNorm = normalize(e.title);
      const match = titles.find((t) => normalize(t) === eNorm);
      return match ? { ...e, recommendedAt: now, prefHash } : e;
    });
    setItem(KEYS.recHistory, updated.slice(-MAX_REC_HISTORY));
    return;
  }
  setItem(KEYS.recHistory, [...existing, ...newEntries].slice(-MAX_REC_HISTORY));
}

export function clearRecHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.recHistory);
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
  // Clean up keys managed outside the KEYS map
  localStorage.removeItem("wsipn_rec_feedback");
  localStorage.removeItem("wsipn_previously_shown");
}
