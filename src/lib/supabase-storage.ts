import { createClient } from "@/lib/supabase/client";
import type {
  TasteProfile,
  CurrentPreferences,
  Recommendation,
  RecommendationSession,
} from "./types";
import type { SteamProfileData } from "./guest-storage";

// Shape of the user_data row
interface UserDataRow {
  user_id: string;
  taste_profile: TasteProfile;
  preferences: CurrentPreferences;
  recommendations: Recommendation[];
  sessions: RecommendationSession[];
  steam_profile: SteamProfileData | null;
  onboarding_step: number;
  updated_at: string;
}

// ── Read all user data ──

export async function fetchUserData(userId: string): Promise<UserDataRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_data")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data as UserDataRow;
}

// ── Upsert (create or update) ──

async function upsertField(userId: string, fields: Partial<Omit<UserDataRow, "user_id" | "updated_at">>) {
  const supabase = createClient();
  const { error } = await supabase
    .from("user_data")
    .upsert(
      { user_id: userId, ...fields },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[supabase-storage] upsert failed:", error.message);
  }
}

// ── Individual field setters (fire-and-forget, called alongside localStorage writes) ──

export function saveTasteProfileRemote(userId: string, profile: TasteProfile) {
  upsertField(userId, { taste_profile: profile });
}

export function savePreferencesRemote(userId: string, prefs: CurrentPreferences) {
  upsertField(userId, { preferences: prefs });
}

export function saveRecommendationsRemote(userId: string, recs: Recommendation[]) {
  upsertField(userId, { recommendations: recs });
}

export function saveSessionsRemote(userId: string, sessions: RecommendationSession[]) {
  upsertField(userId, { sessions });
}

export function saveSteamProfileRemote(userId: string, steam: SteamProfileData) {
  upsertField(userId, { steam_profile: steam });
}

export function saveOnboardingStepRemote(userId: string, step: number) {
  upsertField(userId, { onboarding_step: step });
}

// ── Bulk save (used for localStorage → Supabase migration) ──

export async function saveAllUserData(
  userId: string,
  data: {
    tasteProfile: TasteProfile;
    preferences: CurrentPreferences;
    recommendations: Recommendation[];
    sessions: RecommendationSession[];
    steamProfile: SteamProfileData | null;
    onboardingStep: number;
  }
) {
  await upsertField(userId, {
    taste_profile: data.tasteProfile,
    preferences: data.preferences,
    recommendations: data.recommendations,
    sessions: data.sessions,
    steam_profile: data.steamProfile,
    onboarding_step: data.onboardingStep,
  });
}
