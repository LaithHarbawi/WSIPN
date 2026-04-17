import { createClient } from "@/lib/supabase/client";
import type {
  TasteProfile,
  CurrentPreferences,
  Recommendation,
  RecommendationSession,
  GameEntry,
} from "./types";
import type { SavedGame, SteamProfileData } from "./guest-storage";

// Shape of the user_data row
interface UserDataRow {
  user_id: string;
  taste_profile: TasteProfile;
  preferences: CurrentPreferences;
  recommendations: Recommendation[];
  sessions: RecommendationSession[];
  saved_games: SavedGame[];
  not_interested: string[];
  already_played: string[];
  steam_profile: SteamProfileData | null;
  onboarding_step: number;
  updated_at: string;
}

interface SavedGameRow {
  user_id: string;
  title: string;
  image_url: string | null;
  genres: string[] | null;
  created_at: string;
}

interface UserTitleFeedbackRow {
  user_id: string;
  title: string;
  feedback_type: "not_interested" | "already_played" | "more_like_this";
  created_at: string;
  updated_at: string;
}

interface RecommendationSessionRow {
  id: string;
  user_id: string;
  preferences: CurrentPreferences;
  created_at: string;
}

interface RecommendationResultRow {
  id: string;
  session_id: string;
  user_id: string;
  title: string;
  recommendation_type: Recommendation["type"];
  explanation: string;
  why_matches: string;
  possible_risk: string;
  confidence: string | null;
  genres: string[] | null;
  platforms: string[] | null;
  year: string | null;
  image_url: string | null;
  screenshot_url: string | null;
  metacritic: number | null;
  sort_order: number;
}

interface GameEntryRow {
  id: string;
  user_id: string;
  igdb_id: number | null;
  title: string;
  slug: string | null;
  image_url: string | null;
  sentiment: "loved" | "liked" | "disliked";
  play_status: "completed" | "playing" | "dropped" | null;
  comment: string | null;
  platform: string | null;
  hours_played: number | null;
  genres: string[] | null;
  released: string | null;
  created_at: string;
  updated_at: string;
}

interface UserSettingsRow {
  user_id: string;
  preferences: CurrentPreferences;
  steam_profile: SteamProfileData | null;
  onboarding_step: number;
  updated_at: string;
}

const unavailableTables = new Set<string>();
const warnedTables = new Set<string>();
const TRACKED_REMOTE_TABLES = [
  "user_data",
  "saved_games",
  "user_title_feedback",
  "recommendation_sessions",
  "recommendation_results",
  "game_entries",
  "user_settings",
] as const;

type SupabaseStorageError = {
  code?: string;
  message?: string;
} | null;

function isMissingTableError(error: SupabaseStorageError) {
  if (!error) return false;

  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

function handleTableError(
  table: string,
  error: SupabaseStorageError,
  action: string
) {
  if (!error) return;

  if (isMissingTableError(error)) {
    unavailableTables.add(table);

    if (!warnedTables.has(table)) {
      warnedTables.add(table);
      console.warn(
        `[supabase-storage] ${table} is unavailable; falling back to local-only persistence until Supabase migrations are applied.`
      );
    }
    return;
  }

  console.error(`[supabase-storage] ${action} failed:`, error.message);
}

function isTableUnavailable(table: string) {
  return unavailableTables.has(table);
}

export function isRemotePersistenceUnavailable() {
  return TRACKED_REMOTE_TABLES.every((table) => unavailableTables.has(table));
}

export function getUnavailableRemoteTables() {
  return TRACKED_REMOTE_TABLES.filter((table) => unavailableTables.has(table));
}

export function getRemoteSyncStatus(): "healthy" | "degraded" | "offline" {
  const unavailable = getUnavailableRemoteTables();
  if (unavailable.length === 0) return "healthy";
  if (unavailable.length === TRACKED_REMOTE_TABLES.length) return "offline";
  return "degraded";
}

// ── Read all user data ──

export async function fetchUserData(userId: string): Promise<UserDataRow | null> {
  if (isTableUnavailable("user_data")) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_data")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    handleTableError("user_data", error, "user_data fetch");
    return null;
  }

  if (!data) return null;
  return data as UserDataRow;
}

export async function fetchSavedGamesRemote(userId: string): Promise<SavedGame[]> {
  if (isTableUnavailable("saved_games")) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("saved_games")
    .select("user_id, title, image_url, genres, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    handleTableError("saved_games", error, "saved_games fetch");
    return [];
  }

  if (!data) return [];

  return (data as SavedGameRow[]).map((row) => ({
    title: row.title,
    imageUrl: row.image_url ?? undefined,
    genres: row.genres ?? undefined,
    savedAt: row.created_at,
  }));
}

export async function fetchTitleFeedbackRemote(userId: string): Promise<{
  notInterested: string[];
  alreadyPlayed: string[];
}> {
  if (isTableUnavailable("user_title_feedback")) {
    return { notInterested: [], alreadyPlayed: [] };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_title_feedback")
    .select("user_id, title, feedback_type, created_at, updated_at")
    .eq("user_id", userId);

  if (error) {
    handleTableError("user_title_feedback", error, "user_title_feedback fetch");
    return { notInterested: [], alreadyPlayed: [] };
  }

  if (!data) {
    return { notInterested: [], alreadyPlayed: [] };
  }

  const rows = data as UserTitleFeedbackRow[];
  return {
    notInterested: rows
      .filter((row) => row.feedback_type === "not_interested")
      .map((row) => row.title),
    alreadyPlayed: rows
      .filter((row) => row.feedback_type === "already_played")
      .map((row) => row.title),
  };
}

export async function fetchRecommendationSessionsRemote(
  userId: string
): Promise<RecommendationSession[]> {
  if (
    isTableUnavailable("recommendation_sessions") ||
    isTableUnavailable("recommendation_results")
  ) {
    return [];
  }

  const supabase = createClient();
  const { data: sessionData, error: sessionError } = await supabase
    .from("recommendation_sessions")
    .select("id, user_id, preferences, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (sessionError) {
    handleTableError(
      "recommendation_sessions",
      sessionError,
      "recommendation_sessions fetch"
    );
    return [];
  }

  if (!sessionData || sessionData.length === 0) {
    return [];
  }

  const sessions = sessionData as RecommendationSessionRow[];
  const sessionIds = sessions.map((session) => session.id);

  const { data: resultData, error: resultError } = await supabase
    .from("recommendation_results")
    .select(
      "id, session_id, user_id, title, recommendation_type, explanation, why_matches, possible_risk, confidence, genres, platforms, year, image_url, screenshot_url, metacritic, sort_order"
    )
    .eq("user_id", userId)
    .in("session_id", sessionIds)
    .order("sort_order", { ascending: true });

  if (resultError) {
    handleTableError(
      "recommendation_results",
      resultError,
      "recommendation_results fetch"
    );
    return [];
  }

  const resultsBySession = new Map<string, Recommendation[]>();
  for (const row of (resultData ?? []) as RecommendationResultRow[]) {
    const results = resultsBySession.get(row.session_id) ?? [];
    results.push({
      id: row.id,
      title: row.title,
      type: row.recommendation_type,
      explanation: row.explanation,
      whyMatches: row.why_matches,
      possibleRisk: row.possible_risk,
      confidence: row.confidence ?? undefined,
      genres: row.genres ?? undefined,
      platforms: row.platforms ?? undefined,
      year: row.year ?? undefined,
      imageUrl: row.image_url ?? undefined,
      screenshotUrl: row.screenshot_url ?? undefined,
      metacritic: row.metacritic ?? undefined,
    });
    resultsBySession.set(row.session_id, results);
  }

  return sessions.map((session) => ({
    id: session.id,
    createdAt: session.created_at,
    preferences: session.preferences,
    recommendations: resultsBySession.get(session.id) ?? [],
  }));
}

export async function fetchGameEntriesRemote(
  userId: string
): Promise<TasteProfile> {
  if (isTableUnavailable("game_entries")) {
    return { loved: [], liked: [], disliked: [] };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("game_entries")
    .select(
      "id, user_id, igdb_id, title, slug, image_url, sentiment, play_status, comment, platform, hours_played, genres, released, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    handleTableError("game_entries", error, "game_entries fetch");
    return { loved: [], liked: [], disliked: [] };
  }

  const rows = (data ?? []) as GameEntryRow[];
  const profile: TasteProfile = { loved: [], liked: [], disliked: [] };

  for (const row of rows) {
    const entry: GameEntry = {
      id: row.id,
      igdbId: row.igdb_id ?? undefined,
      title: row.title,
      slug: row.slug ?? undefined,
      imageUrl: row.image_url ?? undefined,
      sentiment: row.sentiment,
      playStatus: row.play_status,
      comment: row.comment ?? undefined,
      platform: row.platform ?? undefined,
      hoursPlayed: row.hours_played ?? undefined,
      genres: row.genres ?? undefined,
      released: row.released ?? undefined,
    };
    profile[row.sentiment].push(entry);
  }

  return profile;
}

export async function fetchUserSettingsRemote(
  userId: string
): Promise<UserSettingsRow | null> {
  if (isTableUnavailable("user_settings")) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id, preferences, steam_profile, onboarding_step, updated_at")
    .eq("user_id", userId)
    .single();

  if (error) {
    handleTableError("user_settings", error, "user_settings fetch");
    return null;
  }

  if (!data) return null;
  return data as UserSettingsRow;
}

// ── Upsert (create or update) ──

async function upsertField(userId: string, fields: Partial<Omit<UserDataRow, "user_id" | "updated_at">>) {
  if (isTableUnavailable("user_data")) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("user_data")
    .upsert(
      { user_id: userId, ...fields },
      { onConflict: "user_id" }
    );

  handleTableError("user_data", error, "user_data upsert");
}

// ── Individual field setters (fire-and-forget, called alongside localStorage writes) ──

export function saveTasteProfileRemote(userId: string, profile: TasteProfile) {
  upsertField(userId, { taste_profile: profile });
}

export function savePreferencesRemote(userId: string, prefs: CurrentPreferences) {
  upsertField(userId, { preferences: prefs });
}

async function upsertUserSettingsField(
  userId: string,
  fields: Partial<Omit<UserSettingsRow, "user_id" | "updated_at">>
) {
  if (isTableUnavailable("user_settings")) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, ...fields },
      { onConflict: "user_id" }
    );

  handleTableError("user_settings", error, "user_settings upsert");
}

export function savePreferencesNormalizedRemote(
  userId: string,
  prefs: CurrentPreferences
) {
  upsertUserSettingsField(userId, { preferences: prefs });
}

export function saveRecommendationsRemote(userId: string, recs: Recommendation[]) {
  upsertField(userId, { recommendations: recs });
}

export function saveSessionsRemote(userId: string, sessions: RecommendationSession[]) {
  upsertField(userId, { sessions });
}

export function saveSavedGamesRemote(userId: string, savedGames: SavedGame[]) {
  upsertField(userId, { saved_games: savedGames });
}

export async function saveRecommendationSessionNormalizedRemote(
  userId: string,
  session: RecommendationSession
): Promise<RecommendationSession | null> {
  if (
    isTableUnavailable("recommendation_sessions") ||
    isTableUnavailable("recommendation_results")
  ) {
    return null;
  }

  const supabase = createClient();
  const { data: sessionRow, error: sessionError } = await supabase
    .from("recommendation_sessions")
    .insert({
      user_id: userId,
      preferences: session.preferences,
      created_at: session.createdAt,
    })
    .select("id, user_id, preferences, created_at")
    .single();

  if (sessionError || !sessionRow) {
    handleTableError(
      "recommendation_sessions",
      sessionError,
      "recommendation_sessions insert"
    );
    return null;
  }

  const insertedSession = sessionRow as RecommendationSessionRow;
  const resultRows = session.recommendations.map((recommendation, index) => ({
    session_id: insertedSession.id,
    user_id: userId,
    title: recommendation.title,
    recommendation_type: recommendation.type,
    explanation: recommendation.explanation,
    why_matches: recommendation.whyMatches,
    possible_risk: recommendation.possibleRisk,
    confidence: recommendation.confidence ?? null,
    genres: recommendation.genres ?? null,
    platforms: recommendation.platforms ?? null,
    year: recommendation.year ?? null,
    image_url: recommendation.imageUrl ?? null,
    screenshot_url: recommendation.screenshotUrl ?? null,
    metacritic: recommendation.metacritic ?? null,
    sort_order: index,
  }));

  if (resultRows.length > 0) {
    const { data: insertedResults, error: resultError } = await supabase
      .from("recommendation_results")
      .insert(resultRows)
      .select(
        "id, session_id, user_id, title, recommendation_type, explanation, why_matches, possible_risk, confidence, genres, platforms, year, image_url, screenshot_url, metacritic, sort_order"
      )
      .order("sort_order", { ascending: true });

    if (resultError) {
      handleTableError(
        "recommendation_results",
        resultError,
        "recommendation_results insert"
      );
      await supabase
        .from("recommendation_sessions")
        .delete()
        .eq("id", insertedSession.id)
        .eq("user_id", userId);
      return null;
    }

    return {
      id: insertedSession.id,
      createdAt: insertedSession.created_at,
      preferences: insertedSession.preferences,
      recommendations: (insertedResults as RecommendationResultRow[]).map((row) => ({
        id: row.id,
        title: row.title,
        type: row.recommendation_type,
        explanation: row.explanation,
        whyMatches: row.why_matches,
        possibleRisk: row.possible_risk,
        confidence: row.confidence ?? undefined,
        genres: row.genres ?? undefined,
        platforms: row.platforms ?? undefined,
        year: row.year ?? undefined,
        imageUrl: row.image_url ?? undefined,
        screenshotUrl: row.screenshot_url ?? undefined,
        metacritic: row.metacritic ?? undefined,
      })),
    };
  }

  return {
    id: insertedSession.id,
    createdAt: insertedSession.created_at,
    preferences: insertedSession.preferences,
    recommendations: [],
  };
}

export async function replaceRecommendationSessionsNormalizedRemote(
  userId: string,
  sessions: RecommendationSession[]
) {
  if (
    isTableUnavailable("recommendation_sessions") ||
    isTableUnavailable("recommendation_results")
  ) {
    return;
  }

  const supabase = createClient();
  const { error: deleteError } = await supabase
    .from("recommendation_sessions")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    handleTableError(
      "recommendation_sessions",
      deleteError,
      "recommendation_sessions reset"
    );
    return;
  }

  for (const session of [...sessions].reverse()) {
    await saveRecommendationSessionNormalizedRemote(userId, session);
  }
}

export async function replaceGameEntriesNormalizedRemote(
  userId: string,
  profile: TasteProfile
) {
  if (isTableUnavailable("game_entries")) return;

  const supabase = createClient();
  const { error: deleteError } = await supabase
    .from("game_entries")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    handleTableError("game_entries", deleteError, "game_entries reset");
    return;
  }

  const rows = [...profile.loved, ...profile.liked, ...profile.disliked].map((entry) => ({
    id: entry.id,
    user_id: userId,
    igdb_id: entry.igdbId ?? null,
    title: entry.title,
    slug: entry.slug ?? null,
    image_url: entry.imageUrl ?? null,
    sentiment: entry.sentiment,
    play_status: entry.playStatus ?? null,
    comment: entry.comment ?? null,
    platform: entry.platform ?? null,
    hours_played: entry.hoursPlayed ?? null,
    genres: entry.genres ?? null,
    released: entry.released ?? null,
  }));

  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from("game_entries").insert(rows);
  handleTableError("game_entries", insertError, "game_entries bulk insert");
}

export async function addSavedGameNormalizedRemote(userId: string, game: SavedGame) {
  if (isTableUnavailable("saved_games")) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("saved_games")
    .upsert(
      {
        user_id: userId,
        title: game.title,
        image_url: game.imageUrl ?? null,
        genres: game.genres ?? null,
        created_at: game.savedAt,
      },
      { onConflict: "user_id,title" }
    );

  handleTableError("saved_games", error, "saved_games upsert");
}

export async function removeSavedGameNormalizedRemote(userId: string, title: string) {
  if (isTableUnavailable("saved_games")) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("saved_games")
    .delete()
    .eq("user_id", userId)
    .eq("title", title);

  handleTableError("saved_games", error, "saved_games delete");
}

export async function replaceSavedGamesNormalizedRemote(userId: string, savedGames: SavedGame[]) {
  if (isTableUnavailable("saved_games")) return;

  const supabase = createClient();
  const { error: deleteError } = await supabase
    .from("saved_games")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    handleTableError("saved_games", deleteError, "saved_games reset");
    return;
  }

  if (savedGames.length === 0) return;

  const { error: insertError } = await supabase
    .from("saved_games")
    .insert(
      savedGames.map((game) => ({
        user_id: userId,
        title: game.title,
        image_url: game.imageUrl ?? null,
        genres: game.genres ?? null,
        created_at: game.savedAt,
      }))
    );

  handleTableError("saved_games", insertError, "saved_games bulk insert");
}

export function saveNotInterestedRemote(userId: string, titles: string[]) {
  upsertField(userId, { not_interested: titles });
}

export function saveAlreadyPlayedRemote(userId: string, titles: string[]) {
  upsertField(userId, { already_played: titles });
}

export async function addTitleFeedbackNormalizedRemote(
  userId: string,
  title: string,
  feedbackType: "not_interested" | "already_played" | "more_like_this"
) {
  if (isTableUnavailable("user_title_feedback")) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("user_title_feedback")
    .upsert(
      {
        user_id: userId,
        title,
        feedback_type: feedbackType,
      },
      { onConflict: "user_id,title,feedback_type" }
    );

  handleTableError("user_title_feedback", error, "user_title_feedback upsert");
}

export async function removeTitleFeedbackNormalizedRemote(
  userId: string,
  title: string,
  feedbackType: "not_interested" | "already_played" | "more_like_this"
) {
  if (isTableUnavailable("user_title_feedback")) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("user_title_feedback")
    .delete()
    .eq("user_id", userId)
    .eq("title", title)
    .eq("feedback_type", feedbackType);

  handleTableError("user_title_feedback", error, "user_title_feedback delete");
}

export async function replaceTitleFeedbackNormalizedRemote(
  userId: string,
  data: {
    notInterested: string[];
    alreadyPlayed: string[];
  }
) {
  if (isTableUnavailable("user_title_feedback")) return;

  const supabase = createClient();
  const { error: deleteError } = await supabase
    .from("user_title_feedback")
    .delete()
    .eq("user_id", userId)
    .in("feedback_type", ["not_interested", "already_played"]);

  if (deleteError) {
    handleTableError("user_title_feedback", deleteError, "user_title_feedback reset");
    return;
  }

  const rows = [
    ...data.notInterested.map((title) => ({
      user_id: userId,
      title,
      feedback_type: "not_interested" as const,
    })),
    ...data.alreadyPlayed.map((title) => ({
      user_id: userId,
      title,
      feedback_type: "already_played" as const,
    })),
  ];

  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from("user_title_feedback")
    .insert(rows);

  handleTableError("user_title_feedback", insertError, "user_title_feedback bulk insert");
}

export function saveSteamProfileRemote(userId: string, steam: SteamProfileData) {
  upsertField(userId, { steam_profile: steam });
}

export function saveSteamProfileNormalizedRemote(
  userId: string,
  steam: SteamProfileData
) {
  upsertUserSettingsField(userId, { steam_profile: steam });
}

export function saveOnboardingStepRemote(userId: string, step: number) {
  upsertField(userId, { onboarding_step: step });
}

export function saveOnboardingStepNormalizedRemote(userId: string, step: number) {
  upsertUserSettingsField(userId, { onboarding_step: step });
}

// ── Bulk save (used for localStorage → Supabase migration) ──

export async function saveAllUserData(
  userId: string,
  data: {
    tasteProfile: TasteProfile;
    preferences: CurrentPreferences;
    recommendations: Recommendation[];
    sessions: RecommendationSession[];
    savedGames: SavedGame[];
    notInterested: string[];
    alreadyPlayed: string[];
    steamProfile: SteamProfileData | null;
    onboardingStep: number;
  }
) {
  await upsertField(userId, {
    taste_profile: data.tasteProfile,
    preferences: data.preferences,
    recommendations: data.recommendations,
    sessions: data.sessions,
    saved_games: data.savedGames,
    not_interested: data.notInterested,
    already_played: data.alreadyPlayed,
    steam_profile: data.steamProfile,
    onboarding_step: data.onboardingStep,
  });
}
