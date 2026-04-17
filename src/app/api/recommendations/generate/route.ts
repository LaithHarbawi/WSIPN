import { NextRequest, NextResponse } from "next/server";
import { generateRecommendations, enrichWithImages } from "@/lib/llm";
import { checkRecommendationRateLimit } from "@/lib/rate-limit";
import type { TasteProfile, CurrentPreferences } from "@/lib/types";

function getRequestIdentifier(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRecommendationRateLimit(getRequestIdentifier(request));
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment before trying again." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(
              1,
              Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
            ).toString(),
          },
        }
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

    return NextResponse.json(
      { recommendations: enriched },
      {
        headers: {
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-RateLimit-Reset": Math.ceil(rateLimit.resetAt / 1000).toString(),
        },
      }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error("Recommendation generation failed:", {
      message: errMsg,
      stack: errStack,
      provider: process.env.OPENAI_API_KEY ? "openai" : "groq",
    });
    return NextResponse.json(
      { error: "Failed to generate recommendations. Please try again." },
      { status: 500 }
    );
  }
}
