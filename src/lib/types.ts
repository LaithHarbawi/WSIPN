// ── Game Metadata ──

export interface GameSearchResult {
  id: number;
  name: string;
  slug: string;
  background_image: string | null;
  released: string | null;
  metacritic: number | null;
  genres: { id: number; name: string }[];
  platforms: { platform: { id: number; name: string } }[];
  short_screenshots?: { id: number; image: string }[];
}

// ── Taste Profile ──

export type GameSentiment = "loved" | "liked" | "disliked";

export type PlayStatus = "completed" | "playing" | "dropped" | null;

export interface GameEntry {
  id: string;
  igdbId?: number;
  title: string;
  slug?: string;
  imageUrl?: string;
  sentiment: GameSentiment;
  comment?: string;
  platform?: string;
  hoursPlayed?: number;
  genres?: string[];
  released?: string;
  playStatus?: PlayStatus;
}

export interface TasteProfile {
  loved: GameEntry[];
  liked: GameEntry[];
  disliked: GameEntry[];
}

// ── Current Preferences ──

export interface CurrentPreferences {
  genres: string[];
  moods: string[];
  difficulty: string;
  gameLength: string;
  playerMode: string;
  scope: string;
  era: string;
  timeCommitment: string;
  platform: string;
  globalComment: string;
}

// ── Recommendations ──

export type RecommendationType =
  | "primary"
  | "discovery"
  | "wildcard"
  | "safe_pick"
  | "surprise";

export interface Recommendation {
  id: string;
  title: string;
  type: RecommendationType;
  explanation: string;
  whyMatches: string;
  possibleRisk: string;
  confidence?: string;
  genres?: string[];
  platforms?: string[];
  year?: string;
  imageUrl?: string;
  screenshotUrl?: string;
  metacritic?: number;
}

export interface RecommendationSession {
  id: string;
  createdAt: string;
  preferences: CurrentPreferences;
  recommendations: Recommendation[];
}

export type RecommendationFeedback =
  | "save"
  | "not_interested"
  | "already_played"
  | "more_like_this";

// ── Onboarding State ──

export type OnboardingStep = 0 | 1 | 2 | 3;

// ── User Mode ──

export type UserMode = "guest" | "authenticated";

// ── Genre and preference options ──

export const GENRE_OPTIONS = [
  "Action",
  "Adventure",
  "RPG",
  "Strategy",
  "Simulation",
  "Puzzle",
  "Platformer",
  "Shooter",
  "Fighting",
  "Racing",
  "Sports",
  "Horror",
  "Survival",
  "Roguelike",
  "Metroidvania",
  "Visual Novel",
  "MMO",
  "Battle Royale",
  "City Builder",
  "Sandbox",
  "Stealth",
  "Rhythm",
  "Tower Defense",
  "Card Game",
  "Souls-like",
  "Open World",
  "JRPG",
  "CRPG",
  "Tactics",
  "Immersive Sim",
] as const;

export const MOOD_OPTIONS = [
  "Relaxing & Chill",
  "Intense & Thrilling",
  "Deeply Immersive",
  "Quick Fun Sessions",
  "Emotionally Moving",
  "Competitive & Challenging",
  "Creative & Expressive",
  "Mysterious & Atmospheric",
  "Social & Cooperative",
  "Nostalgic & Retro",
  "Dark & Gritty",
  "Lighthearted & Fun",
] as const;

export const DIFFICULTY_OPTIONS = [
  "Easy / Story mode",
  "Moderate",
  "Challenging",
  "Punishing / Hardcore",
  "No preference",
] as const;

export const GAME_LENGTH_OPTIONS = [
  "Short (under 10 hours)",
  "Medium (10–30 hours)",
  "Long (30–60 hours)",
  "Epic (60+ hours)",
  "Endless / Live service",
  "No preference",
] as const;

export const PLAYER_MODE_OPTIONS = [
  "Single-player",
  "Multiplayer",
  "Co-op",
  "Any",
] as const;

export const SCOPE_OPTIONS = [
  "Indie",
  "AA",
  "AAA",
  "Any",
] as const;

export const ERA_OPTIONS = [
  "Brand new (last 2 years)",
  "Modern (last 5 years)",
  "Classic (5–15 years)",
  "Retro (15+ years)",
  "Any era",
] as const;

export const TIME_COMMITMENT_OPTIONS = [
  "15–30 min sessions",
  "1–2 hour sessions",
  "Long play sessions (3+ hours)",
  "Varies / No preference",
] as const;

export const PLATFORM_OPTIONS = [
  "PC",
  "PlayStation 5",
  "PlayStation 4",
  "Xbox Series X|S",
  "Xbox One",
  "Nintendo Switch",
  "Steam Deck",
  "Mobile",
  "Any platform",
] as const;
