import type { GameSearchResult } from "./types";

const IGDB_BASE = "https://api.igdb.com/v4";

let cachedToken: { token: string; expiresAt: number } | null = null;

// Get Twitch OAuth token for IGDB API access
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.TWITCH_CLIENT_ID!;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET!;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!res.ok) throw new Error("Failed to get Twitch access token");

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60000, // refresh 1min early
  };
  return cachedToken.token;
}

async function igdbFetch(endpoint: string, body: string): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${IGDB_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!res.ok) {
    console.error(`IGDB ${endpoint} failed:`, res.status);
    return [];
  }
  return res.json();
}

// Convert IGDB cover hash to full image URL
export function igdbImageUrl(
  imageId: string | undefined | null,
  size: "cover_big" | "screenshot_big" | "720p" = "cover_big"
): string | null {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export async function searchGames(query: string): Promise<GameSearchResult[]> {
  if (!query || query.length < 2) return [];

  try {
    const raw = (await igdbFetch(
      "games",
      `search "${query.replace(/"/g, '\\"')}";
       fields name, slug, cover.image_id, first_release_date, total_rating, genres.name, platforms.name;
       limit 10;`
    )) as Array<{
      id: number;
      name: string;
      slug: string;
      cover?: { image_id: string };
      first_release_date?: number;
      total_rating?: number;
      genres?: { name: string }[];
      platforms?: { name: string }[];
    }>;

    return raw.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      background_image: igdbImageUrl(g.cover?.image_id),
      released: g.first_release_date
        ? new Date(g.first_release_date * 1000).toISOString().substring(0, 10)
        : null,
      metacritic: g.total_rating ? Math.round(g.total_rating) : null,
      genres: g.genres?.map((x) => ({ id: 0, name: x.name })) ?? [],
      platforms:
        g.platforms?.map((p) => ({ platform: { id: 0, name: p.name } })) ?? [],
    }));
  } catch (err) {
    console.error("IGDB search failed:", err);
    return [];
  }
}

export async function getPopularGames(
  genres?: string,
  page = 1
): Promise<GameSearchResult[]> {
  const offset = (page - 1) * 40;
  let genreFilter = "";
  if (genres) {
    genreFilter = `where genres.name = ("${genres}");`;
  }

  try {
    const raw = (await igdbFetch(
      "games",
      `fields name, slug, cover.image_id, first_release_date, total_rating, genres.name, platforms.name;
       ${genreFilter}
       sort total_rating desc;
       limit 40;
       offset ${offset};`
    )) as Array<{
      id: number;
      name: string;
      slug: string;
      cover?: { image_id: string };
      first_release_date?: number;
      total_rating?: number;
      genres?: { name: string }[];
      platforms?: { name: string }[];
    }>;

    return raw.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      background_image: igdbImageUrl(g.cover?.image_id),
      released: g.first_release_date
        ? new Date(g.first_release_date * 1000).toISOString().substring(0, 10)
        : null,
      metacritic: g.total_rating ? Math.round(g.total_rating) : null,
      genres: g.genres?.map((x) => ({ id: 0, name: x.name })) ?? [],
      platforms:
        g.platforms?.map((p) => ({ platform: { id: 0, name: p.name } })) ?? [],
    }));
  } catch {
    return [];
  }
}

// Search IGDB for a single game by name (for image enrichment)
// Returns high-res cover (720p) and optional screenshot for hero display
export async function findGameByName(
  title: string
): Promise<{ imageUrl: string | null; screenshotUrl: string | null; rating: number | null }> {
  try {
    const raw = (await igdbFetch(
      "games",
      `search "${title.replace(/"/g, '\\"')}";
       fields name, cover.image_id, screenshots.image_id, artworks.image_id, total_rating;
       limit 1;`
    )) as Array<{
      cover?: { image_id: string };
      screenshots?: { image_id: string }[];
      artworks?: { image_id: string }[];
      total_rating?: number;
    }>;

    const game = raw[0];
    // Use 720p for cover (high res), screenshot_big for backgrounds
    const artworkId = game?.artworks?.[0]?.image_id ?? game?.screenshots?.[0]?.image_id;
    return {
      imageUrl: igdbImageUrl(game?.cover?.image_id, "720p") ?? null,
      screenshotUrl: igdbImageUrl(artworkId, "screenshot_big") ?? null,
      rating: game?.total_rating ? Math.round(game.total_rating) : null,
    };
  } catch {
    return { imageUrl: null, screenshotUrl: null, rating: null };
  }
}
