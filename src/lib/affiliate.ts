// ── Store Links & Affiliate System ──
// Generates purchase links for games across platforms.
// Affiliate tags can be configured per-store for revenue sharing.

export interface StoreLink {
  store: string;
  url: string;
  icon: "steam" | "playstation" | "xbox" | "nintendo" | "gog" | "epic" | "web";
  color: string;
}

// ── Affiliate Configuration ──
// Update these with your actual affiliate/partner IDs
const AFFILIATE_CONFIG = {
  steam: {
    // Steam doesn't have a traditional affiliate program, but you can use
    // Steam curator/partner links or integrate with affiliate networks
    tag: "", // e.g., "?curator_clanid=XXXXX" or partner link
  },
  gog: {
    // GOG affiliate program via Impact
    tag: "", // e.g., "?pp=YOUR_AFFILIATE_ID"
  },
  humble: {
    // Humble Bundle partner program
    tag: "", // e.g., "?partner=YOUR_PARTNER_ID"
  },
  greenManGaming: {
    // GMG affiliate program
    tag: "", // e.g., "?tap_a=XXXXX-XXXXX"
  },
  fanatical: {
    tag: "", // e.g., "?ref=YOUR_REF"
  },
} as const;

function encodeGameTitle(title: string): string {
  return encodeURIComponent(title.replace(/[^\w\s-]/g, "").trim());
}

export function generateStoreLinks(
  title: string,
  platforms?: string[]
): StoreLink[] {
  const links: StoreLink[] = [];
  const encoded = encodeGameTitle(title);
  const platformSet = new Set(
    (platforms ?? []).map((p) => p.toLowerCase())
  );

  const hasPlatform = (keywords: string[]) =>
    platformSet.size === 0 || keywords.some((k) =>
      [...platformSet].some((p) => p.includes(k))
    );

  // Steam — always show for PC games or if no platform specified
  if (hasPlatform(["pc", "steam", "windows", "linux", "mac"])) {
    links.push({
      store: "Steam",
      url: `https://store.steampowered.com/search/?term=${encoded}${AFFILIATE_CONFIG.steam.tag}`,
      icon: "steam",
      color: "#171a21",
    });
  }

  // PlayStation Store
  if (hasPlatform(["playstation", "ps4", "ps5"])) {
    links.push({
      store: "PlayStation",
      url: `https://store.playstation.com/search/${encoded}`,
      icon: "playstation",
      color: "#003087",
    });
  }

  // Xbox / Microsoft Store
  if (hasPlatform(["xbox", "series x", "series s", "xbox one"])) {
    links.push({
      store: "Xbox",
      url: `https://www.xbox.com/en-US/Search/Results?q=${encoded}`,
      icon: "xbox",
      color: "#107c10",
    });
  }

  // Nintendo eShop
  if (hasPlatform(["nintendo", "switch"])) {
    links.push({
      store: "Nintendo",
      url: `https://www.nintendo.com/us/search/#q=${encoded}&cat=games`,
      icon: "nintendo",
      color: "#e60012",
    });
  }

  // GOG — DRM-free, good affiliate program
  if (hasPlatform(["pc", "windows", "linux", "mac", "gog"])) {
    links.push({
      store: "GOG",
      url: `https://www.gog.com/games?query=${encoded}${AFFILIATE_CONFIG.gog.tag}`,
      icon: "gog",
      color: "#86328a",
    });
  }

  // Humble Bundle — great affiliate program
  if (hasPlatform(["pc", "windows", "linux", "mac", "steam"])) {
    links.push({
      store: "Humble",
      url: `https://www.humblebundle.com/store/search?search=${encoded}${AFFILIATE_CONFIG.humble.tag}`,
      icon: "web",
      color: "#cc2929",
    });
  }

  // Green Man Gaming — solid affiliate payouts
  if (hasPlatform(["pc", "windows", "steam"])) {
    links.push({
      store: "GMG",
      url: `https://www.greenmangaming.com/search/?query=${encoded}${AFFILIATE_CONFIG.greenManGaming.tag}`,
      icon: "web",
      color: "#01b84e",
    });
  }

  // If nothing matched, default to Steam + GOG
  if (links.length === 0) {
    links.push(
      {
        store: "Steam",
        url: `https://store.steampowered.com/search/?term=${encoded}${AFFILIATE_CONFIG.steam.tag}`,
        icon: "steam",
        color: "#171a21",
      },
      {
        store: "GOG",
        url: `https://www.gog.com/games?query=${encoded}${AFFILIATE_CONFIG.gog.tag}`,
        icon: "gog",
        color: "#86328a",
      }
    );
  }

  return links;
}

// Get the primary/best store link for a game (Steam preferred)
export function getPrimaryStoreLink(
  title: string,
  platforms?: string[]
): StoreLink {
  const links = generateStoreLinks(title, platforms);
  return links[0];
}
