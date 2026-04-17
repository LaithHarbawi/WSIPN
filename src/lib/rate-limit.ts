import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const FALLBACK_RATE_LIMIT = 5;
const FALLBACK_WINDOW_MS = 60_000;
const fallbackRateMap = new Map<string, { count: number; resetAt: number }>();

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

function normalizeIdentifier(identifier: string) {
  return createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

function checkFallbackRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const key = normalizeIdentifier(identifier);
  const entry = fallbackRateMap.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + FALLBACK_WINDOW_MS;
    fallbackRateMap.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: FALLBACK_RATE_LIMIT - 1,
      resetAt,
    };
  }

  if (entry.count >= FALLBACK_RATE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(FALLBACK_RATE_LIMIT - entry.count, 0),
    resetAt: entry.resetAt,
  };
}

export async function checkRecommendationRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  try {
    const supabase = createAdminClient();
    const hashedIdentifier = normalizeIdentifier(identifier);
    const { data, error } = await (supabase as typeof supabase & {
      rpc: (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("check_rate_limit", {
      p_route_key: "recommendations_generate",
      p_identifier: hashedIdentifier,
      p_limit: FALLBACK_RATE_LIMIT,
      p_window_seconds: FALLBACK_WINDOW_MS / 1000,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== "boolean") {
      throw new Error("Rate limit RPC returned an unexpected response.");
    }

    return {
      allowed: row.allowed,
      remaining: Number.isFinite(row.remaining) ? row.remaining : 0,
      resetAt: new Date(row.reset_at).getTime(),
    };
  } catch (error) {
    console.warn("Falling back to in-memory rate limit:", error);
    return checkFallbackRateLimit(identifier);
  }
}
