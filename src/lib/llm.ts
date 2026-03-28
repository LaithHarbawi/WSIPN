import OpenAI from "openai";
import type {
  TasteProfile,
  CurrentPreferences,
  Recommendation,
} from "./types";
import type {
  MergedGroupTaste,
  GroupParticipant,
  GroupRecommendation,
} from "./group-merge";
import { findGameByName } from "./game-api";

// LLM provider chain: Groq (free, fast) → OpenAI (fallback)
// Groq runs Llama 3.3 70B on custom hardware — free tier: 30 RPM, 15K tokens/min
// OpenAI GPT-4o used as fallback if Groq is unavailable

const groqClient = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    })
  : null;

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/** Call LLM with automatic fallback: Groq → OpenAI */
async function llmChat(
  messages: { role: "system" | "user"; content: string }[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 8000, temperature = 0.9 } = opts;

  const callProvider = async (
    client: OpenAI,
    model: string,
    label: string
  ): Promise<string> => {
    console.log(`[LLM] Calling ${label} (${model})...`);
    const completion = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      response_format: { type: "json_object" },
      messages,
    });
    const text = completion.choices[0]?.message?.content ?? "";
    if (!text) throw new Error(`${label} returned empty response`);
    return text;
  };

  // Try Groq first (free + fast), fall back to OpenAI
  if (groqClient) {
    try {
      return await callProvider(groqClient, "llama-3.3-70b-versatile", "Groq");
    } catch (err) {
      console.error("[LLM] Groq failed, attempting OpenAI fallback:", err);
      if (openaiClient) {
        return await callProvider(openaiClient, "gpt-4o", "OpenAI");
      }
      throw err;
    }
  }

  if (openaiClient) {
    return await callProvider(openaiClient, "gpt-4o", "OpenAI");
  }

  throw new Error("No LLM provider configured — set GROQ_API_KEY or OPENAI_API_KEY");
}

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
  if (prefs.playerMode !== "Any") {
    if (prefs.playerMode === "Friendslop") {
      lines.push(`Player Mode: Party / Social games — think Jackbox, Lethal Company, Among Us, Mario Party style games that groups of friends play together`);
    } else {
      lines.push(`Player Mode: ${prefs.playerMode}`);
    }
  }
  if (prefs.era !== "Any era") lines.push(`Era: ${prefs.era}`);
  if (prefs.timeCommitment !== "Varies / No preference")
    lines.push(`Session Length: ${prefs.timeCommitment}`);
  if (prefs.platforms?.length) lines.push(`Platforms: ${prefs.platforms.join(", ")}`);
  return lines.join("\n") || "No specific preferences — open to anything.";
}

function buildGlobalComment(prefs: CurrentPreferences): string {
  if (!prefs.globalComment?.trim()) return "";
  return `\n## Player's Global Notes (HIGH PRIORITY — treat as direct instructions)\n${prefs.globalComment.trim()}`;
}

const SYSTEM_PROMPT = `You are an expert video game recommendation engine with encyclopedic knowledge of games across all platforms, eras, and genres — including indie, niche, cult-classic, and under-the-radar titles.

## ANTI-BIAS RULE — This Is the Most Important Rule
DO NOT default to "go-to" popular recommendations. Every recommendation MUST be justified SOLELY by the user's specific taste profile, comments, and preferences — NOT by a game's general popularity, critical acclaim, or how frequently it appears in "best of" lists.

Ask yourself for EACH pick: "Would I recommend this exact game if it had 100 Steam reviews instead of 100,000?" If the answer is no — if you're recommending it partly because it's well-known — replace it with a better-matched but lesser-known alternative.

Games like Deep Rock Galactic, Stardew Valley, Hollow Knight, Celeste, Hades, Disco Elysium, Outer Wilds, Baldur's Gate 3, and similar "Reddit favorites" should ONLY appear if the user's profile provides overwhelming specific evidence they'd enjoy those exact mechanics. Being a "good game" is NOT sufficient reason to recommend it.

## Priority Hierarchy (follow this order strictly)
1. **GLOBAL COMMENT / PLAYER NOTES** — If the user writes free-form notes, these are the #1 signal. They override and refine everything else. Base your recommendations primarily on what the player explicitly asks for.
2. **User comments on individual games** — A comment like "loved the exploration but combat felt shallow" is the next highest signal. Mine every comment for specific mechanical and emotional preferences.
3. **Disliked/dropped games** — These define hard anti-patterns you must avoid.
4. **Loved games + playtime data** — High-hour games reveal lifestyle preferences.
5. **Liked games** — Secondary positive signal.
6. **Session preferences** (genres, mood, difficulty, etc.) — Act as filters on top of taste.

## REALITY RULE — Only Real Games
CRITICAL: Every game you recommend MUST be a real, commercially released video game that can be purchased or downloaded. NEVER invent, fabricate, or hallucinate game titles. If you are not certain a game exists, do not recommend it. Stick to games you are confident are real.

## ACCURACY RULES — No Fabricated Connections
This is critical. You MUST only make comparisons between games that share CONCRETE, VERIFIABLE mechanical or structural similarities:
- GOOD: "Like Hollow Knight, this is a 2D metroidvania with tight combat and interconnected map exploration."
- BAD: "Like Outer Wilds' depth combined with Disco Elysium's narrative..." — these games share almost nothing mechanically.
- NEVER compare games that only share vague qualities like "depth", "atmosphere", or "quality."
- Every comparison must be grounded in SPECIFIC shared mechanics, structure, or design philosophy.
- If you can't articulate a concrete mechanical connection, don't make the comparison.
- Reference the user's actual comments when possible — if they said "loved the platforming", connect to platforming specifically.

## DISCOVERY MANDATE — Avoid Popularity Bias
You MUST actively resist recommending only well-known AAA titles. For EVERY pick (not just DISCOVERY):
- Ask: "Is this game truly the BEST match, or just the most FAMOUS match?"
- Prioritize specificity of match over fame of game
- For DISCOVERY picks specifically: target games with under 10K Steam reviews, niche audiences, or limited mainstream coverage
- Look for indie gems, AA titles, international/non-Western games, cult classics, and overlooked titles from smaller studios
- If a user loves Hades, don't just suggest Dead Cells — find the lesser-known roguelite that nails the same feeling
- NEVER recommend more than 2 games that would appear on a typical "top 100 games of all time" list

## Justification Requirement
For EACH recommendation, you must be able to point to SPECIFIC elements in the user's profile that justify it:
- A specific game they loved/liked and what mechanical DNA it shares
- A specific comment they made that this game addresses
- A specific mood/preference combination that this game uniquely satisfies
If you cannot point to something specific in their profile, do not recommend the game.

## Analysis Framework
Before generating recommendations, internally analyze:
- Core motivations (mastery, exploration, narrative, social, creative expression, collecting, optimization)
- Mechanical preferences (deck-building, roguelite loops, physics puzzles, tactical combat, base-building, etc.)
- Anti-patterns from dislikes and drops
- Taste intersections across loved genres, moods, and mechanics
- Playtime-weighted preferences — high-hour games matter more
- What makes this user's taste UNIQUE — lean into their distinctive preferences, not generic "gamer" preferences

## Output Rules
- Return exactly 12 recommendations as a JSON object with a "recommendations" key containing an array.
- Distribution: 4 PRIMARY, 4 DISCOVERY, 2 WILDCARD, 1 SAFE_PICK, 1 SURPRISE.
- PRIMARY: Strong taste-profile matches. Can include known games but ONLY with genuine, specific taste connections grounded in the user's comments and games.
- DISCOVERY: Hidden gems, indie darlings, cult classics, or under-appreciated titles. These MUST NOT be mainstream/AAA blockbusters or well-known indie hits. If a game has over 50K Steam reviews, it is NOT a discovery pick. Dig deep — recommend games most players haven't heard of. Games like RimWorld, Deep Rock Galactic, Valheim, Terraria, etc. are NOT hidden gems.
- WILDCARD: Thoughtful stretches — genres or styles the user hasn't explored but might love based on deeper pattern analysis.
- SAFE_PICK: A high-confidence pick the user will almost certainly enjoy. Even this must be justified by their specific profile, not just general popularity.
- SURPRISE: A left-field recommendation that challenges assumptions.
- Each recommendation object must have: title, type, explanation, whyMatches, possibleRisk, confidence, genres, platforms, year.
- "explanation" (2-3 sentences): Reference SPECIFIC mechanics, systems, or design elements from the user's games. Never make vague thematic comparisons.
- "whyMatches" (1-2 sentences): Cite the SPECIFIC game(s) from the user's profile and the concrete shared mechanics or structure. Must reference at least one game the user rated.
- "possibleRisk" (1 sentence): Ground in their specific dislikes or drops if applicable. Otherwise note a genuine potential friction point.
- "confidence": "High" | "Medium" | "Likely"
- Never recommend a game the user has already entered or that appears in their Steam library.
- Return ONLY valid JSON — no markdown, no commentary outside the JSON object.`;

export async function generateRecommendations(
  profile: TasteProfile,
  preferences: CurrentPreferences,
  steamLibraryTitles?: string[]
): Promise<Recommendation[]> {
  const allEnteredTitles = [
    ...profile.loved,
    ...profile.liked,
    ...profile.disliked,
  ].map((g) => g.title.toLowerCase());

  // Merge steam library titles (5+ hours) into exclusion list
  const steamExclusions = (steamLibraryTitles ?? []).map((t) => t.toLowerCase());
  const allExcludedTitles = [...new Set([...allEnteredTitles, ...steamExclusions])];

  const userMessage = `## My Taste Profile
${buildTasteProfileSummary(profile)}

## What I Want to Play Right Now
${buildPreferencesSummary(preferences)}
${buildGlobalComment(preferences)}

## Games to NEVER recommend (I already own/played these):
${allExcludedTitles.join(", ")}

Give me 12 personalized recommendations based SOLELY on my taste profile and preferences above. Each pick must be justified by specific games I rated or comments I made — not by general popularity. Include at least 4 DISCOVERY picks that are genuine hidden gems most gamers haven't heard of. Return them as a JSON object with a "recommendations" array.`;

  const text = await llmChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { maxTokens: 8000, temperature: 0.9 }
  );

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
  // Use normalized fuzzy matching to catch LLM title variations like "The Outer Wilds" vs "Outer Wilds"
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const excludedNormalized = allExcludedTitles.map(normalize);
  const seen = new Set<string>();
  const filtered = raw.filter((r) => {
    const key = r.title.toLowerCase();
    const keyNorm = normalize(r.title);
    if (seen.has(keyNorm)) return false;
    // Check exact match or fuzzy substring match against exclusion list
    const isExcluded = allExcludedTitles.includes(key)
      || excludedNormalized.some((ex) => {
        if (ex === keyNorm) return true;
        const shorter = ex.length <= keyNorm.length ? ex : keyNorm;
        const longer = ex.length > keyNorm.length ? ex : keyNorm;
        return shorter.length >= 8 && longer.includes(shorter);
      });
    if (isExcluded) return false;
    seen.add(keyNorm);
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

// Enrich recommendations with IGDB images + filter out hallucinated games
// Any game that IGDB cannot verify is dropped from the results
export async function enrichWithImages(
  recommendations: Recommendation[]
): Promise<Recommendation[]> {
  const results = await Promise.all(
    recommendations.map(async (rec): Promise<Recommendation | null> => {
      try {
        const { imageUrl, screenshotUrl, rating, verified } = await findGameByName(rec.title, rec.year);
        if (!verified) {
          console.warn(`Dropping unverified game: "${rec.title}" — not found in IGDB`);
          return null;
        }
        return {
          ...rec,
          imageUrl: imageUrl ?? rec.imageUrl,
          screenshotUrl: screenshotUrl ?? rec.screenshotUrl,
          metacritic: rating ?? rec.metacritic,
        };
      } catch {
        return null; // Can't verify — drop it
      }
    })
  );
  return results.filter((r): r is Recommendation => r !== null);
}

// Enrich group recommendations with IGDB images + filter out hallucinated games
export async function enrichGroupWithImages(
  recommendations: GroupRecommendation[]
): Promise<GroupRecommendation[]> {
  const results = await Promise.all(
    recommendations.map(async (rec): Promise<GroupRecommendation | null> => {
      try {
        const { imageUrl, screenshotUrl, rating, verified } = await findGameByName(rec.title, rec.year);
        if (!verified) {
          console.warn(`Dropping unverified group game: "${rec.title}" — not found in IGDB`);
          return null;
        }
        return {
          ...rec,
          imageUrl: imageUrl ?? rec.imageUrl,
          screenshotUrl: screenshotUrl ?? rec.screenshotUrl,
          metacritic: rating ?? rec.metacritic,
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter((r): r is GroupRecommendation => r !== null);
}

// ── Group Recommendations ──

const GROUP_SYSTEM_PROMPT = `You are an expert video game recommendation engine specialized in finding games that work for GROUPS of players with different tastes. You will receive a merged taste summary showing how multiple players' preferences overlap and conflict.

## REALITY RULE — Only Real Games
Every game you recommend MUST be a real, commercially released video game. NEVER invent or fabricate game titles.

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
    if (filterPreferences.platforms?.length)
      lines.push(`Platforms: ${filterPreferences.platforms.join(", ")}`);
    if (lines.length) filterSection = `\n## Session Filters\n${lines.join("\n")}`;
  }

  const userMessage = `## Group Members (${participants.length} players)
${buildGroupProfileSummary(participants, merged)}
${filterSection}

## Games to NEVER recommend (already played by group members):
${Array.from(allTitles).join(", ")}

Find 7 games this group can enjoy together. Return as JSON with a "recommendations" array.`;

  const text = await llmChat(
    [
      { role: "system", content: GROUP_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { maxTokens: 5000, temperature: 0.85 }
  );

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
