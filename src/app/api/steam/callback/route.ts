import { NextRequest, NextResponse } from "next/server";

/**
 * Steam OpenID 2.0 callback handler.
 * Verifies the Steam login response and redirects back to the app
 * with the user's Steam64 ID as a query parameter.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = request.nextUrl.origin;

  // Extract claimed_id — contains the Steam64 ID
  // Format: https://steamcommunity.com/openid/id/76561198012345678
  const claimedId = params.get("openid.claimed_id");
  if (!claimedId) {
    return NextResponse.redirect(`${origin}/onboarding?steam_error=no_id`);
  }

  const steamIdMatch = claimedId.match(/\/openid\/id\/(\d{17})$/);
  if (!steamIdMatch) {
    return NextResponse.redirect(`${origin}/onboarding?steam_error=invalid_id`);
  }

  const steamId = steamIdMatch[1];

  // Verify the response with Steam (check_authentication)
  // This prevents spoofed responses
  const verifyParams = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    verifyParams.set(key, value);
  }
  verifyParams.set("openid.mode", "check_authentication");

  try {
    const verifyRes = await fetch(
      "https://steamcommunity.com/openid/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: verifyParams.toString(),
      }
    );
    const verifyText = await verifyRes.text();

    if (!verifyText.includes("is_valid:true")) {
      console.error("[Steam OpenID] Verification failed:", verifyText);
      return NextResponse.redirect(`${origin}/onboarding?steam_error=verification_failed`);
    }
  } catch (err) {
    console.error("[Steam OpenID] Verification request failed:", err);
    return NextResponse.redirect(`${origin}/onboarding?steam_error=verification_failed`);
  }

  // Redirect back to the app with the verified Steam ID
  return NextResponse.redirect(`${origin}/onboarding?steam_id=${steamId}`);
}
