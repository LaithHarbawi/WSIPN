import { NextRequest, NextResponse } from "next/server";

const STEAM_API = "https://api.steampowered.com";

// Resolve a vanity URL (custom Steam profile name) to a Steam ID
async function resolveVanityUrl(
  vanityName: string,
  apiKey: string
): Promise<string | null> {
  const res = await fetch(
    `${STEAM_API}/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${vanityName}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.response?.success === 1) {
    return data.response.steamid;
  }
  return null;
}

// Parse a Steam profile URL or ID into a Steam64 ID
async function parseSteamInput(
  input: string,
  apiKey: string
): Promise<string | null> {
  const trimmed = input.trim().replace(/\/+$/, "");

  // Direct Steam64 ID (17-digit number)
  if (/^\d{17}$/.test(trimmed)) {
    return trimmed;
  }

  // URL format: https://steamcommunity.com/profiles/76561198012345678
  const profilesMatch = trimmed.match(
    /steamcommunity\.com\/profiles\/(\d{17})/
  );
  if (profilesMatch) {
    return profilesMatch[1];
  }

  // URL format: https://steamcommunity.com/id/vanityname
  const idMatch = trimmed.match(/steamcommunity\.com\/id\/([^/]+)/);
  if (idMatch) {
    return resolveVanityUrl(idMatch[1], apiKey);
  }

  // Bare vanity name
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return resolveVanityUrl(trimmed, apiKey);
  }

  return null;
}

export async function GET(request: NextRequest) {
  const steamInput = request.nextUrl.searchParams.get("id");
  if (!steamInput) {
    return NextResponse.json(
      { error: "Steam profile URL or ID required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Steam API key not configured" },
      { status: 500 }
    );
  }

  // Resolve to Steam64 ID
  const steamId = await parseSteamInput(steamInput, apiKey);
  if (!steamId) {
    return NextResponse.json(
      {
        error:
          "Could not resolve Steam ID. Make sure the profile URL is correct and the profile is public.",
      },
      { status: 400 }
    );
  }

  // Fetch owned games
  const params = new URLSearchParams({
    key: apiKey,
    steamid: steamId,
    include_appinfo: "1",
    include_played_free_games: "1",
    format: "json",
  });

  const res = await fetch(
    `${STEAM_API}/IPlayerService/GetOwnedGames/v1/?${params}`
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch Steam library" },
      { status: 502 }
    );
  }

  const data = await res.json();
  const games = data.response?.games;

  if (!games || games.length === 0) {
    return NextResponse.json(
      {
        error:
          "No games found. Make sure the Steam profile is set to public and game details are visible.",
      },
      { status: 404 }
    );
  }

  // Sort by playtime descending (most played first)
  const sorted = games
    .map(
      (g: {
        appid: number;
        name: string;
        playtime_forever: number;
        img_icon_url: string;
      }) => ({
        appId: g.appid,
        name: g.name,
        playtimeMinutes: g.playtime_forever,
        playtimeHours: Math.round(g.playtime_forever / 60),
        iconUrl: g.img_icon_url
          ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
          : null,
        headerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
      })
    )
    .sort(
      (a: { playtimeMinutes: number }, b: { playtimeMinutes: number }) =>
        b.playtimeMinutes - a.playtimeMinutes
    );

  return NextResponse.json({
    steamId,
    gameCount: sorted.length,
    games: sorted,
  });
}
