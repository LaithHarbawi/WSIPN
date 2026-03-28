import { NextRequest, NextResponse } from "next/server";
import { searchGames } from "@/lib/game-api";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "IGDB credentials not configured" },
      { status: 500 }
    );
  }

  try {
    const results = await searchGames(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
