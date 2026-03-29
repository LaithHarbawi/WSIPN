"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { fetchUserData } from "@/lib/supabase-storage";
import {
  Sparkles,
  ArrowRight,
  User,
  Users,
  ChevronRight,
  Heart,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { WsipnLogo } from "@/components/ui/wsipn-logo";

// Sample game covers for the visual showcase (IGDB 720p)
const SHOWCASE_GAMES = [
  { title: "The Witcher 3", img: "https://images.igdb.com/igdb/image/upload/t_720p/co1wyy.jpg" },
  { title: "Hollow Knight", img: "https://images.igdb.com/igdb/image/upload/t_720p/co1rgi.jpg" },
  { title: "Hades", img: "https://images.igdb.com/igdb/image/upload/t_720p/co2a2s.jpg" },
  { title: "Celeste", img: "https://images.igdb.com/igdb/image/upload/t_720p/co3byy.jpg" },
  { title: "Stardew Valley", img: "https://images.igdb.com/igdb/image/upload/t_720p/xrpmydnu9rpxvxfjkiu7.jpg" },
  { title: "Elden Ring", img: "https://images.igdb.com/igdb/image/upload/t_720p/co4jni.jpg" },
  { title: "Balan Wonderworld", img: "https://images.igdb.com/igdb/image/upload/t_720p/co2z9l.jpg" },
  { title: "Baldur's Gate 3", img: "https://images.igdb.com/igdb/image/upload/t_720p/co670h.jpg" },
];

function GameTile({ title, img, sentiment, delay }: {
  title: string;
  img: string;
  sentiment?: "loved" | "liked" | "disliked";
  delay: string;
}) {
  const icons = {
    loved: <Heart className="h-3 w-3 text-loved fill-loved" />,
    liked: <ThumbsUp className="h-3 w-3 text-liked" />,
    disliked: <ThumbsDown className="h-3 w-3 text-disliked" />,
  };
  return (
    <div
      className="relative group rounded-xl overflow-hidden shadow-lg animate-fade-in-up flex-shrink-0 w-[120px]"
      style={{ animationDelay: delay }}
    >
      <Image
        src={img}
        alt={title}
        width={120}
        height={160}
        sizes="120px"
        className="w-full aspect-[3/4] object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-[10px] font-semibold text-white/90 truncate leading-tight">{title}</p>
        {sentiment && (
          <div className="mt-0.5">{icons[sentiment]}</div>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string | null; id: string } | null>(null);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    let active = true;

    try {
      const raw = localStorage.getItem("wsipn_taste_profile");
      if (raw) {
        const profile = JSON.parse(raw);
        if (profile.loved?.length > 0 || profile.liked?.length > 0 || profile.disliked?.length > 0) {
          setHasProfile(true);
        }
      }
    } catch {
      // Ignore malformed local data and fall back to remote state when available.
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return () => {
        active = false;
      };
    }

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser({
          name: data.user.user_metadata?.display_name ?? data.user.email?.split("@")[0] ?? null,
          id: data.user.id,
        });

        const remoteData = await fetchUserData(data.user.id);
        const remoteProfile = remoteData?.taste_profile ?? { loved: [], liked: [], disliked: [] };
        const remoteHasGames =
          (remoteProfile.loved?.length ?? 0) +
          (remoteProfile.liked?.length ?? 0) +
          (remoteProfile.disliked?.length ?? 0) > 0;
        const remoteCompleted = (remoteData?.onboarding_step ?? 0) >= 3;

        if (active && (remoteHasGames || remoteCompleted)) {
          setHasProfile(true);
        }
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setHasProfile(false);
  };

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-30%] left-[10%] w-[50%] h-[50%] rounded-full bg-accent-primary/[0.04] blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[5%] w-[40%] h-[40%] rounded-full bg-accent-secondary/[0.03] blur-[130px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-10 py-5 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <WsipnLogo size={36} className="shadow-lg shadow-accent-primary/20" />
          <span className="text-lg font-bold tracking-tight text-text-bright">What Should I Play Next?</span>
        </div>
        {user ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-text-muted"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/auth/signin")}
          >
            Sign In
          </Button>
        )}
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 px-6">
        <div className="max-w-6xl mx-auto pt-16 sm:pt-24 pb-12">
          <div className="text-center max-w-2xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-primary/[0.06] border border-accent-primary/12 text-accent-primary text-[13px] font-semibold tracking-wide mb-8">
              <Sparkles className="h-3.5 w-3.5" />
              {user ? "Welcome back" : "Smart Game Discovery"}
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-[72px] font-black tracking-tighter leading-[1.02]">
              {user ? (
                <>
                  {user.name ? (
                    <>Hey,{" "}<span className="text-gradient">{user.name}</span></>
                  ) : (
                    <>Ready to <span className="text-gradient">play</span>?</>
                  )}
                </>
              ) : (
                <>
                  Find your next{" "}
                  <span className="text-gradient">obsession</span>
                </>
              )}
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary max-w-lg mx-auto leading-relaxed font-light mt-6">
              {user
                ? hasProfile
                  ? "Your taste profile is ready. Generate fresh recommendations or refine your preferences."
                  : "Let\u2019s build your taste profile. Rate some games and we\u2019ll find your perfect match."
                : <>
                    Tell us what you love, what you couldn&apos;t stand, and what you&apos;re
                    in the mood for. Our system understands{" "}
                    <em className="text-text-primary font-normal not-italic">why</em> you play.
                  </>
              }
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
              {user ? (
                <>
                  {hasProfile ? (
                    <>
                      <Button
                        size="xl"
                        onClick={() => router.push("/recommendations")}
                        className="group w-full sm:w-auto min-w-[200px]"
                      >
                        <Sparkles className="h-4 w-4" />
                        View Recommendations
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => router.push("/dashboard")}
                        className="w-full sm:w-auto"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="xl"
                      onClick={() => router.push("/onboarding")}
                      className="group w-full sm:w-auto min-w-[200px]"
                    >
                      Build Your Profile
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    size="xl"
                    onClick={() => router.push("/onboarding")}
                    className="group w-full sm:w-auto min-w-[200px]"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => router.push("/auth/signup")}
                    className="w-full sm:w-auto"
                  >
                    <User className="h-4 w-4" />
                    Create Account
                  </Button>
                </>
              )}
            </div>
            {!user && (
              <p className="text-[13px] text-text-muted mt-5">
                No account required — start discovering as a guest
              </p>
            )}
            <button
              onClick={() => router.push("/group")}
              className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent-primary mt-3 transition-colors font-medium"
            >
              <Users className="h-4 w-4" />
              Playing with friends? Try Group Recommendations
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* ── Game showcase strip ── */}
          <div className="mt-20 relative">
            <div className="flex items-end justify-center gap-3 overflow-hidden">
              {SHOWCASE_GAMES.map((g, i) => (
                <GameTile
                  key={g.title}
                  {...g}
                  sentiment={i < 3 ? "loved" : i < 5 ? "liked" : undefined}
                  delay={`${i * 80}ms`}
                />
              ))}
            </div>
            {/* Fade edges */}
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-bg-primary to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-bg-primary to-transparent pointer-events-none" />
          </div>
        </div>

        {/* ── How It Works ── */}
        <section className="max-w-5xl mx-auto pb-32 pt-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              How it works
            </h2>
            <p className="text-text-secondary mt-3 text-base max-w-md mx-auto">
              Three steps. No algorithms guessing from your purchase history.
              Just your actual taste.
            </p>
          </div>

          <div className="space-y-24 sm:space-y-32">
            {/* Step 1 — Rate */}
            <div className="flex flex-col sm:flex-row items-center gap-10 sm:gap-16">
              <div className="flex-1 order-2 sm:order-1">
                <span className="text-accent-primary text-xs font-bold uppercase tracking-widest">Step 1</span>
                <h3 className="text-2xl font-bold mt-2 tracking-tight">Rate your games</h3>
                <p className="text-text-secondary mt-3 leading-relaxed">
                  Import your Steam library in one click, or search and add games manually.
                  Rate them as loved, liked, or disliked — and optionally leave a comment
                  about what specifically you enjoyed or didn&apos;t.
                </p>
                <p className="text-sm text-text-muted mt-3 italic">
                  &ldquo;I loved the exploration but the combat felt shallow&rdquo; — that
                  one comment tells us more than a star rating ever could.
                </p>
              </div>
              {/* Visual: mini rating UI */}
              <div className="flex-shrink-0 order-1 sm:order-2 w-full sm:w-[320px]">
                <div className="rounded-2xl border border-border-subtle bg-bg-card/60 p-5 shadow-card space-y-3">
                  {[
                    { title: "Hollow Knight", img: SHOWCASE_GAMES[1].img, sentiment: "loved" as const },
                    { title: "Elden Ring", img: SHOWCASE_GAMES[5].img, sentiment: "liked" as const },
                    { title: "Balan Wonderworld", img: SHOWCASE_GAMES[6].img, sentiment: "disliked" as const },
                  ].map((g) => (
                    <div key={g.title} className="flex items-center gap-3">
                      <Image
                        src={g.img}
                        alt=""
                        width={40}
                        height={40}
                        sizes="40px"
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                      <span className="text-sm font-medium flex-1 truncate">{g.title}</span>
                      <div className={`p-1.5 rounded-lg ${
                        g.sentiment === "loved" ? "bg-loved/15 text-loved" :
                        g.sentiment === "liked" ? "bg-liked/15 text-liked" :
                        "bg-disliked/15 text-disliked"
                      }`}>
                        {g.sentiment === "loved" ? <Heart className="h-3.5 w-3.5 fill-current" /> :
                         g.sentiment === "liked" ? <ThumbsUp className="h-3.5 w-3.5" /> :
                         <ThumbsDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-2 pt-2 border-t border-border-subtle/60">
                    <MessageSquare className="h-3.5 w-3.5 text-text-muted mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-text-muted italic leading-relaxed">
                      &ldquo;Loved the atmosphere and tight platforming. The map system made exploration feel rewarding.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 — Mood */}
            <div className="flex flex-col sm:flex-row items-center gap-10 sm:gap-16">
              <div className="flex-shrink-0 w-full sm:w-[320px]">
                <div className="rounded-2xl border border-border-subtle bg-bg-card/60 p-5 shadow-card space-y-4">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Current mood</p>
                  <div className="flex flex-wrap gap-2">
                    {["Deeply Immersive", "Challenging", "Single-player", "RPG", "30–60 hours"].map((tag, i) => (
                      <span
                        key={tag}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                          i < 3
                            ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/20"
                            : "bg-bg-tertiary text-text-secondary border border-border-subtle"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-text-muted">
                    These preferences filter on top of your permanent taste profile — change them every session.
                  </p>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-accent-primary text-xs font-bold uppercase tracking-widest">Step 2</span>
                <h3 className="text-2xl font-bold mt-2 tracking-tight">Set the mood</h3>
                <p className="text-text-secondary mt-3 leading-relaxed">
                  What are you in the mood for <em>right now</em>? Pick genres, difficulty,
                  session length, platform — or leave it wide open. These are session
                  filters, not permanent preferences.
                </p>
                <p className="text-sm text-text-muted mt-3 italic">
                  Saturday night with hours to kill? Very different from a Tuesday lunch break.
                </p>
              </div>
            </div>

            {/* Step 3 — Results */}
            <div className="flex flex-col sm:flex-row items-center gap-10 sm:gap-16">
              <div className="flex-1 order-2 sm:order-1">
                <span className="text-accent-primary text-xs font-bold uppercase tracking-widest">Step 3</span>
                <h3 className="text-2xl font-bold mt-2 tracking-tight">Discover, don&apos;t scroll</h3>
                <p className="text-text-secondary mt-3 leading-relaxed">
                  Get 12 personalized picks — each with a detailed explanation of exactly
                  <em> why</em> it matches your taste. Not generic bestseller lists.
                  Real connections to the games you already love.
                </p>
                <p className="text-sm text-text-muted mt-3 italic">
                  &ldquo;Your love for Hollow Knight&apos;s tight controls and
                  Dead Cells&apos; run variety points to someone who craves mechanical
                  mastery with meaningful progression.&rdquo;
                </p>
              </div>
              {/* Visual: recommendation preview */}
              <div className="flex-shrink-0 order-1 sm:order-2 w-full sm:w-[320px]">
                <div className="rounded-2xl border border-border-subtle bg-bg-card/60 overflow-hidden shadow-card">
                  <div className="relative h-36">
                    <Image
                      src="https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc8g11.jpg"
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, 320px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-card/95 via-bg-card/30 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-accent-primary">Top Pick</span>
                      <h4 className="text-base font-bold text-white mt-0.5">Outer Wilds</h4>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-xs text-text-secondary leading-relaxed">
                      A mystery wrapped in a solar system — the same curiosity-driven
                      exploration loop that made Hollow Knight&apos;s map so rewarding.
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {["Adventure", "Exploration", "Indie"].map((g) => (
                        <span key={g} className="text-[10px] px-2 py-0.5 rounded-md bg-bg-tertiary text-text-muted">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center mt-24">
            <Button
              size="xl"
              onClick={() => router.push(user && hasProfile ? "/recommendations" : "/onboarding")}
              className="group"
            >
              {user && hasProfile ? "Get Recommendations" : "Start Your Profile"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
            <p className="text-[13px] text-text-muted mt-4">
              {user && hasProfile
                ? "Your profile is ready — let\u2019s find something new."
                : "Takes about 2 minutes. Works best with 5+ rated games."
              }
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
