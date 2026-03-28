import { NextRequest, NextResponse } from "next/server";
import { generateRecommendations, enrichWithImages } from "@/lib/llm";
import { getPopularGames } from "@/lib/game-api";
import type { TasteProfile, CurrentPreferences, GameSearchResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tasteProfile, preferences, steamLibraryTitles, notInterestedTitles } = body as {
      tasteProfile: TasteProfile;
      preferences: CurrentPreferences;
      steamLibraryTitles?: string[];
      notInterestedTitles?: string[];
    };

    if (!tasteProfile) {
      return NextResponse.json(
        { error: "Taste profile required" },
        { status: 400 }
      );
    }

    // Gather broad candidate pool from IGDB for context
    const hasIgdb =
      process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET;
    let candidates: GameSearchResult[] = [];
    if (hasIgdb) {
      try {
        const results = await Promise.all([
          getPopularGames(undefined, 1),
          getPopularGames(undefined, 2),
        ]);
        candidates = results.flat();
      } catch {
        // Candidates are optional — LLM can work without them
      }
    }

    // Generate recommendations via LLM
    // Merge all exclusion titles
    const allExclusions = [
      ...(steamLibraryTitles ?? []),
      ...(notInterestedTitles ?? []),
    ];

    const recommendations = await generateRecommendations(
      tasteProfile,
      preferences,
      candidates,
      allExclusions.length > 0 ? allExclusions : undefined
    );

    // Enrich with cover images from IGDB
    const enriched = hasIgdb
      ? await enrichWithImages(recommendations)
      : recommendations;

    return NextResponse.json({ recommendations: enriched });
  } catch (error) {
    console.error("Recommendation generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations. Please try again." },
      { status: 500 }
    );
  }
}
