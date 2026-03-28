import { NextRequest, NextResponse } from "next/server";
import { generateRecommendations, enrichWithImages } from "@/lib/llm";
import type { TasteProfile, CurrentPreferences } from "@/lib/types";

// Simple in-memory rate limiter: max 5 requests per IP per minute
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment before trying again." },
        { status: 429 }
      );
    }
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

    const totalGames =
      (tasteProfile.loved?.length ?? 0) +
      (tasteProfile.liked?.length ?? 0) +
      (tasteProfile.disliked?.length ?? 0);
    if (totalGames === 0) {
      return NextResponse.json(
        { error: "Add at least one game to your taste profile first." },
        { status: 400 }
      );
    }

    const hasIgdb =
      process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET;

    // Merge all exclusion titles
    const allExclusions = [
      ...(steamLibraryTitles ?? []),
      ...(notInterestedTitles ?? []),
    ];

    const recommendations = await generateRecommendations(
      tasteProfile,
      preferences,
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
