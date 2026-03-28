import { NextRequest, NextResponse } from "next/server";

/**
 * Steam OpenID 2.0 login initiation.
 * Redirects the user to Steam's login page, which then redirects back
 * to /api/steam/callback with their Steam64 ID.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const returnTo = `${origin}/api/steam/callback`;

  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  return NextResponse.redirect(
    `https://steamcommunity.com/openid/login?${params.toString()}`
  );
}
