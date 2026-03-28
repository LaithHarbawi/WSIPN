import type { TasteProfile, GameEntry, CurrentPreferences } from "./types";

// ── Group Types ──

export interface GroupParticipant {
  id: string;
  name: string;
  tasteProfile: TasteProfile;
  preferences: CurrentPreferences;
}

export interface MergedGroupTaste {
  /** Games scored by aggregate sentiment: loved=+3, liked=+1, disliked=-3 */
  scoredGames: ScoredGame[];
  /** Genres weighted by how many participants prefer them */
  topGenres: string[];
  /** Combined mood preferences */
  topMoods: string[];
  /** Consensus preferences (most common non-default values) */
  consensusPreferences: CurrentPreferences;
  /** Games everyone should avoid (disliked by 2+ members) */
  universalDislikes: string[];
  /** Number of participants */
  participantCount: number;
}

export interface ScoredGame {
  title: string;
  score: number;
  /** Which participants rated this and how */
  ratings: { participant: string; sentiment: "loved" | "liked" | "disliked" }[];
}

export interface GroupRecommendation {
  id: string;
  title: string;
  explanation: string;
  groupFit: string;
  possibleConflict: string;
  confidence: string;
  genres?: string[];
  platforms?: string[];
  year?: string;
  imageUrl?: string;
  screenshotUrl?: string;
  metacritic?: number;
}

export interface GroupSession {
  id: string;
  createdAt: string;
  participants: { id: string; name: string }[];
  recommendations: GroupRecommendation[];
}

// ── Merge Algorithm ──

const SENTIMENT_WEIGHTS = {
  loved: 3,
  liked: 1,
  disliked: -3,
} as const;

export function mergeGroupTaste(participants: GroupParticipant[]): MergedGroupTaste {
  // 1. Score all games across participants
  const gameScores = new Map<string, ScoredGame>();

  for (const p of participants) {
    const sentiments: ("loved" | "liked" | "disliked")[] = ["loved", "liked", "disliked"];
    for (const sentiment of sentiments) {
      for (const game of p.tasteProfile[sentiment]) {
        const key = game.title.toLowerCase();
        if (!gameScores.has(key)) {
          gameScores.set(key, { title: game.title, score: 0, ratings: [] });
        }
        const entry = gameScores.get(key)!;
        entry.score += SENTIMENT_WEIGHTS[sentiment];
        entry.ratings.push({ participant: p.name, sentiment });
      }
    }
  }

  const scoredGames = Array.from(gameScores.values()).sort((a, b) => b.score - a.score);

  // 2. Aggregate genre preferences
  const genreCounts = new Map<string, number>();
  for (const p of participants) {
    for (const genre of p.preferences.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    // Also count genres from loved games
    for (const game of p.tasteProfile.loved) {
      for (const genre of game.genres ?? []) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 0.5);
      }
    }
  }
  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([genre]) => genre);

  // 3. Aggregate mood preferences
  const moodCounts = new Map<string, number>();
  for (const p of participants) {
    for (const mood of p.preferences.moods) {
      moodCounts.set(mood, (moodCounts.get(mood) ?? 0) + 1);
    }
  }
  const topMoods = Array.from(moodCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([mood]) => mood);

  // 4. Consensus preferences (pick most common non-default value)
  const consensusPreferences = buildConsensusPreferences(participants);

  // 5. Universal dislikes (disliked by 2+ members)
  const universalDislikes = scoredGames
    .filter((g) => {
      const dislikeCount = g.ratings.filter((r) => r.sentiment === "disliked").length;
      return dislikeCount >= 2;
    })
    .map((g) => g.title);

  return {
    scoredGames,
    topGenres,
    topMoods,
    consensusPreferences,
    universalDislikes,
    participantCount: participants.length,
  };
}

function buildConsensusPreferences(participants: GroupParticipant[]): CurrentPreferences {
  const defaults: CurrentPreferences = {
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

  function mostCommon(values: string[], defaultVal: string): string {
    const filtered = values.filter((v) => v !== defaultVal);
    if (filtered.length === 0) return defaultVal;
    const counts = new Map<string, number>();
    for (const v of filtered) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  return {
    ...defaults,
    difficulty: mostCommon(participants.map((p) => p.preferences.difficulty), "No preference"),
    gameLength: mostCommon(participants.map((p) => p.preferences.gameLength), "No preference"),
    playerMode: mostCommon(participants.map((p) => p.preferences.playerMode), "Any"),
    era: mostCommon(participants.map((p) => p.preferences.era), "Any era"),
    timeCommitment: mostCommon(participants.map((p) => p.preferences.timeCommitment), "Varies / No preference"),
    platforms: [...new Set(participants.flatMap((p) => p.preferences.platforms))],
  };
}
