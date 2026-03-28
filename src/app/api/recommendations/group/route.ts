import { NextRequest, NextResponse } from "next/server";
import { generateGroupRecommendations, enrichGroupWithImages } from "@/lib/llm";
import { mergeGroupTaste } from "@/lib/group-merge";
import type { GroupParticipant } from "@/lib/group-merge";
import type { CurrentPreferences } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { participants, filterPreferences } = body as {
      participants: GroupParticipant[];
      filterPreferences?: Partial<CurrentPreferences>;
    };

    if (!participants || participants.length < 2) {
      return NextResponse.json(
        { error: "At least 2 participants required" },
        { status: 400 }
      );
    }

    if (participants.length > 8) {
      return NextResponse.json(
        { error: "Maximum 8 participants supported" },
        { status: 400 }
      );
    }

    // Merge group taste profiles
    const merged = mergeGroupTaste(participants);

    // Generate group recommendations via LLM
    const recommendations = await generateGroupRecommendations(
      participants,
      merged,
      filterPreferences
    );

    // Enrich with cover images from IGDB
    const hasIgdb =
      process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET;
    const enriched = hasIgdb
      ? await enrichGroupWithImages(recommendations)
      : recommendations;

    return NextResponse.json({
      recommendations: enriched,
      merged: {
        topGenres: merged.topGenres,
        topMoods: merged.topMoods,
        universalDislikes: merged.universalDislikes,
        participantCount: merged.participantCount,
        sharedFavorites: merged.scoredGames
          .filter((g) => g.score >= 4 && g.ratings.length >= 2)
          .slice(0, 5)
          .map((g) => g.title),
      },
    });
  } catch (error) {
    console.error("Group recommendation generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate group recommendations. Please try again." },
      { status: 500 }
    );
  }
}
