import OpenAI from "openai";
import type {
  TasteProfile,
  CurrentPreferences,
  Recommendation,
  GameSearchResult,
} from "./types";
import type {
  MergedGroupTaste,
  GroupParticipant,
  GroupRecommendation,
} from "./group-merge";
import { findGameByName } from "./game-api";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildTasteProfileSummary(profile: TasteProfile): string {
  const sections: string[] = [];

  const formatEntries = (entries: TasteProfile[keyof TasteProfile]) =>
    entries
      .map((g) => {
        let line = `- ${g.title}`;
        if (g.genres?.length) line += ` (${g.genres.join(", ")})`;
        if (g.playStatus) line += ` [${g.playStatus}]`;
        if (g.comment) line += `\n  Comment: "${g.comment}"`;
        if (g.platform) line += ` | Platform: ${g.platform}`;
        if (g.hoursPlayed) line += ` | Hours: ~${g.hoursPlayed}`;
        return line;
      })
      .join("\n");

  if (profile.loved.length) {
    sections.push(`LOVED (absolute favorites):\n${formatEntries(profile.loved)}`);
  }
  if (profile.liked.length) {
    sections.push(`LIKED (enjoyed):\n${formatEntries(profile.liked)}`);
  }
  if (profile.disliked.length) {
    sections.push(`DISLIKED:\n${formatEntries(profile.disliked)}`);
  }

  return sections.join("\n\n");
}

function buildPreferencesSummary(prefs: CurrentPreferences): string {
  const lines: string[] = [];
  if (prefs.genres.length) lines.push(`Genres: ${prefs.genres.join(", ")}`);
  if (prefs.moods.length) lines.push(`Mood/Vibe: ${prefs.moods.join(", ")}`);
  if (prefs.difficulty !== "No preference") lines.push(`Difficulty: ${prefs.difficulty}`);
  if (prefs.gameLength !== "No preference") lines.push(`Length: ${prefs.gameLength}`);
  if (prefs.playerMode !== "Any") lines.push(`Player Mode: ${prefs.playerMode}`);
  if (prefs.scope !== "Any") lines.push(`Scope: ${prefs.scope}`);
  if (prefs.era !== "Any era") lines.push(`Era: ${prefs.era}`);
  if (prefs.timeCommitment !== "Varies / No preference")
    lines.push(`Session Length: ${prefs.timeCommitment}`);
  if (prefs.platform !== "Any platform") lines.push(`Platform: ${prefs.platform}`);
  return lines.join("\n") || "No specific preferences — open to anything.";
}

function buildCandidateList(candidates: GameSearchResult[]): string {
  if (!candidates.length) return "No specific candidate pool available — use your broad knowledge.";
  return candidates
    .map((g) => {
      const genres = g.genres?.map((x) => x.name).join(", ") || "unknown";
      const year = g.released?.substring(0, 4) || "unknown";
      const score = g.metacritic ? `Rating: ${g.metacritic}` : "";
      return `- ${g.name} (${year}, ${genres}) ${score}`.trim();
    })
    .join("\n");
}

const SYSTEM_PROMPT = `You are an expert video game recommendation engine with encyclopedic knowledge of games across all platforms, eras, and genres. Your purpose is to analyze a player's taste profile — including their loved, liked, and disliked games along with any comments and play-status metadata — and produce deeply personalized recommendations.

## Core Principles
1. Every recommendation must be grounded in the user's specific taste signals — never recommend generically popular games without a clear connection to their profile.
2. User comments are the highest-value signal. A comment like "loved the exploration but combat felt shallow" tells you far more than the game title alone. Mine every comment for mechanical and emotional preferences.
3. Disliked games are just as important as loved games. They define anti-patterns you must avoid.
4. Games marked as "dropped" (play_status) indicate experiences that failed to retain the player — analyze why.
5. Playtime data reveals what truly hooks this player. Hundreds of hours in a game is a lifestyle choice — understand what drives that.
6. When the user provides current-mood preferences (genres, difficulty, length, etc.), those act as SESSION FILTERS on top of their permanent taste profile.

## Analysis Framework
Before generating recommendations, internally analyze:
- Core motivations (mastery, exploration, narrative, social, creative expression, collecting, optimization)
- Mechanical preferences (deck-building, roguelite loops, physics puzzles, tactical combat, base-building, etc.)
- Anti-patterns from dislikes and drops
- Taste intersections across loved genres, moods, and mechanics
- Playtime-weighted preferences — high-hour games matter more

## Output Rules
- Return exactly 9 recommendations as a JSON object with a "recommendations" key containing an array.
- Distribution: 5 PRIMARY, 2 WILDCARD, 1 SAFE_PICK, 1 SURPRISE.
- Each recommendation object must have: title, type, explanation, whyMatches, possibleRisk, confidence, genres, platforms, year.
- "explanation" (2-3 sentences): MUST directly reference the user's specific games and explain the connection. Example: "You sank 200 hours into Stardew Valley and called Hollow Knight 'perfect' — Spiritfarer merges that same cozy management loop with an emotionally resonant narrative and gorgeous hand-drawn exploration."
- "whyMatches" (1-2 sentences): Draw a clear line between specific profile games and this pick. Example: "Your love for Celeste's tight controls and Dead Cells' run variety points to someone who craves mechanical mastery with meaningful progression."
- "possibleRisk" (1 sentence): Ground the risk in their profile. Example: "You dropped Pillars of Eternity citing 'too much reading' — this game's first hour is dialogue-heavy, but it opens into pure exploration quickly."
- "confidence": "High" | "Medium" | "Likely"
- Never recommend a game the user has already entered.
- Return ONLY valid JSON — no markdown, no commentary outside the JSON object.`;

export async function generateRecommendations(
  profile: TasteProfile,
  preferences: CurrentPreferences,
  candidates: GameSearchResult[]
): Promise<Recommendation[]> {
  const allEnteredTitles = [
    ...profile.loved,
    ...profile.liked,
    ...profile.disliked,
  ].map((g) => g.title.toLowerCase());

  const userMessage = `## My Taste Profile
${buildTasteProfileSummary(profile)}

## What I Want to Play Right Now
${buildPreferencesSummary(preferences)}

## Candidate Pool (optional reference — you can recommend outside this list)
${buildCandidateList(candidates)}

## Games to NEVER recommend (I already own/played these):
${allEnteredTitles.join(", ")}

Give me 9 personalized recommendations based on my profile. Return them as a JSON object with a "recommendations" array.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 6000,
    temperature: 0.85,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";

  // Parse structured JSON response
  let raw: Array<{
    title: string;
    type: string;
    explanation: string;
    whyMatches: string;
    possibleRisk: string;
    confidence?: string;
    genres?: string[];
    platforms?: string[];
    year?: string;
  }>;

  try {
    const parsed = JSON.parse(text);
    // Handle both { recommendations: [...] } and raw array
    raw = Array.isArray(parsed) ? parsed : (parsed.recommendations ?? []);
  } catch {
    // Fallback: try to extract array from text
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to parse recommendation response");
    }
    raw = JSON.parse(jsonMatch[0]);
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("No recommendations returned from LLM");
  }

  // Defensive: filter out duplicates and titles already in user's profile
  const seen = new Set<string>();
  const filtered = raw.filter((r) => {
    const key = r.title.toLowerCase();
    if (seen.has(key) || allEnteredTitles.includes(key)) return false;
    seen.add(key);
    return true;
  });

  return filtered.map((r, i) => ({
    id: `rec-${Date.now()}-${i}`,
    title: r.title,
    type: r.type.toLowerCase() as Recommendation["type"],
    explanation: r.explanation,
    whyMatches: r.whyMatches,
    possibleRisk: r.possibleRisk,
    confidence: r.confidence,
    genres: r.genres,
    platforms: r.platforms,
    year: r.year,
  }));
}

// Enrich recommendations with IGDB images (high-res covers + screenshots)
export async function enrichWithImages(
  recommendations: Recommendation[]
): Promise<Recommendation[]> {
  const enriched = await Promise.all(
    recommendations.map(async (rec) => {
      try {
        const { imageUrl, screenshotUrl, rating } = await findGameByName(rec.title);
        return {
          ...rec,
          imageUrl: imageUrl ?? rec.imageUrl,
          screenshotUrl: screenshotUrl ?? rec.screenshotUrl,
          metacritic: rating ?? rec.metacritic,
        };
      } catch {
        return rec;
      }
    })
  );
  return enriched;
}

// Enrich group recommendations with IGDB images
export async function enrichGroupWithImages(
  recommendations: GroupRecommendation[]
): Promise<GroupRecommendation[]> {
  const enriched = await Promise.all(
    recommendations.map(async (rec) => {
      try {
        const { imageUrl, screenshotUrl, rating } = await findGameByName(rec.title);
        return {
          ...rec,
          imageUrl: imageUrl ?? rec.imageUrl,
          screenshotUrl: screenshotUrl ?? rec.screenshotUrl,
          metacritic: rating ?? rec.metacritic,
        };
      } catch {
        return rec;
      }
    })
  );
  return enriched;
}

// ── Group Recommendations ──

const GROUP_SYSTEM_PROMPT = `You are an expert video game recommendation engine specialized in finding games that work for GROUPS of players with different tastes. You will receive a merged taste summary showing how multiple players' preferences overlap and conflict.

## Core Principles
1. Group recommendations must satisfy the MOST people — prioritize high-overlap games.
2. Explicitly address potential conflicts: if Player A loves horror but Player B hates it, acknowledge this.
3. Weight universally loved genres/mechanics higher than individual preferences.
4. Universal dislikes are hard vetoes — never recommend games similar to them.
5. When tastes diverge, look for "bridge games" that satisfy different players for different reasons.

## Output Rules
- Return exactly 7 recommendations as a JSON object with a "recommendations" key.
- Each recommendation must have: title, explanation, groupFit, possibleConflict, confidence, genres, platforms, year.
- "explanation" (2-3 sentences): Describe why this game works for the GROUP, referencing specific participants by name.
- "groupFit" (1-2 sentences): Explain which group members will love it and why.
- "possibleConflict" (1 sentence): Which member(s) might not enjoy it and why, based on their dislikes.
- "confidence": "High" | "Medium" | "Likely"
- Return ONLY valid JSON.`;

function buildGroupProfileSummary(
  participants: GroupParticipant[],
  merged: MergedGroupTaste
): string {
  const sections: string[] = [];

  // Per-participant summaries
  for (const p of participants) {
    const lines: string[] = [`### ${p.name}`];
    if (p.tasteProfile.loved.length) {
      lines.push(`  Loved: ${p.tasteProfile.loved.map((g) => g.title).join(", ")}`);
    }
    if (p.tasteProfile.liked.length) {
      lines.push(`  Liked: ${p.tasteProfile.liked.map((g) => g.title).join(", ")}`);
    }
    if (p.tasteProfile.disliked.length) {
      lines.push(`  Disliked: ${p.tasteProfile.disliked.map((g) => g.title).join(", ")}`);
    }
    if (p.preferences.genres.length) {
      lines.push(`  Preferred genres: ${p.preferences.genres.join(", ")}`);
    }
    sections.push(lines.join("\n"));
  }

  // Merged summary
  sections.push(`\n## Group Overlap`);
  if (merged.topGenres.length) {
    sections.push(`Shared top genres: ${merged.topGenres.join(", ")}`);
  }
  if (merged.topMoods.length) {
    sections.push(`Shared moods: ${merged.topMoods.join(", ")}`);
  }
  if (merged.universalDislikes.length) {
    sections.push(`Universal dislikes (AVOID similar games): ${merged.universalDislikes.join(", ")}`);
  }

  // Top scored games (games multiple people love)
  const sharedFavorites = merged.scoredGames
    .filter((g) => g.score >= 4 && g.ratings.length >= 2)
    .slice(0, 10);
  if (sharedFavorites.length) {
    sections.push(
      `Shared favorites:\n${sharedFavorites
        .map((g) => `- ${g.title} (score: ${g.score}, rated by: ${g.ratings.map((r) => `${r.participant}=${r.sentiment}`).join(", ")})`)
        .join("\n")}`
    );
  }

  return sections.join("\n");
}

export async function generateGroupRecommendations(
  participants: GroupParticipant[],
  merged: MergedGroupTaste,
  filterPreferences?: Partial<CurrentPreferences>
): Promise<GroupRecommendation[]> {
  const allTitles = new Set<string>();
  for (const p of participants) {
    for (const s of ["loved", "liked", "disliked"] as const) {
      for (const g of p.tasteProfile[s]) {
        allTitles.add(g.title.toLowerCase());
      }
    }
  }

  let filterSection = "";
  if (filterPreferences) {
    const lines: string[] = [];
    if (filterPreferences.genres?.length) lines.push(`Genres: ${filterPreferences.genres.join(", ")}`);
    if (filterPreferences.playerMode && filterPreferences.playerMode !== "Any")
      lines.push(`Player Mode: ${filterPreferences.playerMode}`);
    if (filterPreferences.platform && filterPreferences.platform !== "Any platform")
      lines.push(`Platform: ${filterPreferences.platform}`);
    if (lines.length) filterSection = `\n## Session Filters\n${lines.join("\n")}`;
  }

  const userMessage = `## Group Members (${participants.length} players)
${buildGroupProfileSummary(participants, merged)}
${filterSection}

## Games to NEVER recommend (already played by group members):
${Array.from(allTitles).join(", ")}

Find 7 games this group can enjoy together. Return as JSON with a "recommendations" array.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 5000,
    temperature: 0.85,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: GROUP_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";

  let raw: Array<{
    title: string;
    explanation: string;
    groupFit: string;
    possibleConflict: string;
    confidence?: string;
    genres?: string[];
    platforms?: string[];
    year?: string;
  }>;

  try {
    const parsed = JSON.parse(text);
    raw = Array.isArray(parsed) ? parsed : (parsed.recommendations ?? []);
  } catch {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Failed to parse group recommendation response");
    raw = JSON.parse(jsonMatch[0]);
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("No group recommendations returned from LLM");
  }

  // Defensive: filter out duplicates and titles already in participants' profiles
  const seen = new Set<string>();
  const filtered = raw.filter((r) => {
    const key = r.title.toLowerCase();
    if (seen.has(key) || allTitles.has(key)) return false;
    seen.add(key);
    return true;
  });

  return filtered.map((r, i) => ({
    id: `group-rec-${Date.now()}-${i}`,
    title: r.title,
    explanation: r.explanation,
    groupFit: r.groupFit,
    possibleConflict: r.possibleConflict,
    confidence: r.confidence ?? "Medium",
    genres: r.genres,
    platforms: r.platforms,
    year: r.year,
  }));
}
