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
// Sizes: cover_big (264x374), 720p (1280x720), screenshot_big (889x500), 1080p (1920x1080)
export function igdbImageUrl(
  imageId: string | undefined | null,
  size: "cover_big" | "screenshot_big" | "720p" | "1080p" = "cover_big"
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
    const sanitized = genres.replace(/["\\]/g, "");
    genreFilter = `where genres.name = ("${sanitized}");`;
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

// Search IGDB for a single game by name (for image enrichment + validation)
// Returns high-res cover (720p) and 1080p artwork/screenshot for hero display
// `verified` is true only when IGDB returns a game whose name closely matches the query
export async function findGameByName(
  title: string,
  year?: string
): Promise<{ imageUrl: string | null; screenshotUrl: string | null; rating: number | null; verified: boolean }> {
  try {
    const raw = (await igdbFetch(
      "games",
      `search "${title.replace(/"/g, '\\"')}";
       fields name, first_release_date, cover.image_id, screenshots.image_id, artworks.image_id, total_rating;
       limit 10;`
    )) as Array<{
      name: string;
      first_release_date?: number;
      cover?: { image_id: string };
      screenshots?: { image_id: string }[];
      artworks?: { image_id: string }[];
      total_rating?: number;
    }>;

    // Find best match — prioritize exact name + year match, then exact name, then fuzzy
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = normalize(title);
    const getYear = (ts?: number) => ts ? new Date(ts * 1000).getFullYear().toString() : null;

    const fuzzySubstring = (a: string, b: string) => {
      const shorter = a.length <= b.length ? a : b;
      const longer = a.length > b.length ? a : b;
      return shorter.length >= 8 && longer.includes(shorter);
    };

    // Score each result for best match
    const scored = raw.map((g) => {
      const gNorm = normalize(g.name);
      const gYear = getYear(g.first_release_date);
      let score = 0;

      // Name matching (required — skip if no match at all)
      if (gNorm === target) {
        score += 100; // Exact name match
      } else if (fuzzySubstring(gNorm, target)) {
        score += 50; // Fuzzy substring match
      } else {
        return { game: g, score: -1 }; // No match
      }

      // Year matching (bonus — helps disambiguate remakes, mods, etc.)
      if (year && gYear) {
        if (gYear === year) score += 20; // Exact year match
        else if (Math.abs(parseInt(gYear) - parseInt(year)) <= 1) score += 10; // Off by 1 year
      }

      // Prefer games with covers (more likely to be the right game)
      if (g.cover?.image_id) score += 5;
      // Prefer games with artworks/screenshots (better image quality)
      if (g.artworks?.length) score += 3;
      if (g.screenshots?.length) score += 2;
      // Prefer rated games (less likely to be obscure duplicates)
      if (g.total_rating) score += 2;

      return { game: g, score };
    });

    // Get the best match that actually matched
    const best = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (!best) {
      return { imageUrl: null, screenshotUrl: null, rating: null, verified: false };
    }

    const match = best.game;
    const verified = best.score >= 50; // At least a fuzzy name match

    // Use 720p for cover, prefer artworks (promotional art) over screenshots for hero
    // Artworks are designed as banner images and look much better at large sizes
    const heroImageId = match.artworks?.[0]?.image_id ?? match.screenshots?.[0]?.image_id;
    return {
      imageUrl: igdbImageUrl(match.cover?.image_id, "720p") ?? null,
      screenshotUrl: igdbImageUrl(heroImageId, "1080p") ?? null,
      rating: match.total_rating ? Math.round(match.total_rating) : null,
      verified,
    };
  } catch {
    return { imageUrl: null, screenshotUrl: null, rating: null, verified: false };
  }
}
