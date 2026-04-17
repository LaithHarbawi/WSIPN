"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { WsipnLogo } from "@/components/ui/wsipn-logo";
import { ArrowRight, User, Ghost, Info, Sparkles } from "lucide-react";
import { useAppStore } from "@/contexts/app-store";
import { createClient } from "@/lib/supabase/client";

export function StepWelcome() {
  const router = useRouter();
  const { setOnboardingStep, setUserMode } = useAppStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  // Check if user is already signed in
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setIsAuthenticated(true);
        setUserName(data.user.user_metadata?.display_name ?? null);
        setUserMode("authenticated", data.user.id);
      }
    });
  }, [setUserMode]);

  const continueAsGuest = () => {
    setUserMode("guest");
    setOnboardingStep(1);
  };

  const continueAuthenticated = () => {
    setOnboardingStep(1);
  };

  return (
    <div className="max-w-md mx-auto text-center py-6 sm:py-10">
      {/* --- Inline keyframes for mount animations --- */}
      <style>{`
        @keyframes welcome-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes welcome-scale-in {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes welcome-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.45; }
          50%      { transform: scale(1.18); opacity: 0; }
        }
        @keyframes welcome-icon-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        .anim-icon   { animation: welcome-scale-in 0.6s cubic-bezier(.16,1,.3,1) both; }
        .anim-h1     { animation: welcome-fade-up 0.55s cubic-bezier(.16,1,.3,1) 0.12s both; }
        .anim-sub    { animation: welcome-fade-up 0.55s cubic-bezier(.16,1,.3,1) 0.22s both; }
        .anim-cta    { animation: welcome-fade-up 0.5s cubic-bezier(.16,1,.3,1) 0.32s both; }
        .anim-div    { animation: welcome-fade-up 0.5s cubic-bezier(.16,1,.3,1) 0.40s both; }
        .anim-sec    { animation: welcome-fade-up 0.5s cubic-bezier(.16,1,.3,1) 0.48s both; }
        .anim-link   { animation: welcome-fade-up 0.45s cubic-bezier(.16,1,.3,1) 0.56s both; }
        .anim-info   { animation: welcome-fade-up 0.45s cubic-bezier(.16,1,.3,1) 0.64s both; }
        .pulse-ring  { animation: welcome-pulse-ring 2.8s ease-in-out infinite; }
        .icon-float  { animation: welcome-icon-float 3.4s ease-in-out infinite; }
      `}</style>

      {/* ========== Hero icon ========== */}
      <div className="anim-icon flex items-center justify-center mb-8">
        <div className="relative">
          <div className="pulse-ring absolute inset-[-12px] rounded-3xl bg-gradient-accent opacity-40 blur-md" />
          <WsipnLogo size={80} className="icon-float glow-md shadow-2xl shadow-accent-primary/30 !rounded-3xl" />
        </div>
      </div>

      {/* ========== Headline ========== */}
      <h1 className="anim-h1 text-4xl sm:text-[2.75rem] font-extrabold tracking-tight leading-[1.1] mb-4">
        {isAuthenticated && userName ? (
          <>Welcome, <span className="text-gradient">{userName}</span></>
        ) : (
          <>What should you{" "}<span className="text-gradient">play&nbsp;next</span>?</>
        )}
      </h1>

      {/* ========== Subtitle ========== */}
      <p className="anim-sub text-text-secondary text-base sm:text-lg leading-relaxed max-w-sm mx-auto mb-10">
        {isAuthenticated
          ? "Let\u2019s build your taste profile. Rate some games and we\u2019ll find your perfect match."
          : "Tell us about games you love and what you\u2019re in the mood for. We\u2019ll find your perfect match."
        }
      </p>

      {/* ========== CTAs ========== */}
      <div className="space-y-4 mb-2">
        {isAuthenticated ? (
          /* ── Authenticated flow ── */
          <div className="anim-cta">
            <Button
              size="xl"
              onClick={continueAuthenticated}
              className="w-full group relative overflow-hidden"
            >
              <Sparkles className="h-5 w-5" />
              <span>Add Your Games</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </div>
        ) : (
          /* ── Guest/unauthenticated flow ── */
          <>
            <div className="anim-cta">
              <Button
                size="xl"
                onClick={continueAsGuest}
                className="w-full group relative overflow-hidden"
              >
                <Ghost className="h-5 w-5" />
                <span>Continue as Guest</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </div>

            <div className="anim-div flex items-center gap-4">
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-xs font-medium uppercase tracking-widest text-text-muted select-none">or</span>
              <div className="flex-1 h-px bg-border-subtle" />
            </div>

            <div className="anim-sec">
              <Button
                variant="secondary"
                size="xl"
                onClick={() => router.push("/auth/signup")}
                className="w-full group"
              >
                <User className="h-5 w-5" />
                <span>Create an Account</span>
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
              </Button>
            </div>

            <div className="anim-link pt-1">
              <button
                onClick={() => router.push("/auth/signin")}
                className="text-sm text-text-muted hover:text-accent-primary transition-colors duration-200 cursor-pointer"
              >
                Already have an account?{" "}
                <span className="font-semibold underline underline-offset-2 decoration-accent-primary/40 hover:decoration-accent-primary">
                  Sign&nbsp;in
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ========== Info box ========== */}
      <div className="anim-info mt-8 glass rounded-2xl border border-border-subtle p-4 flex items-start gap-3 text-left shadow-card">
        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center">
          <Info className="h-3.5 w-3.5 text-accent-primary" />
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          {isAuthenticated
            ? "Your profile is saved to your account. You can access it from any device."
            : "Guest data is saved locally in your browser. Create an account anytime to save your profile and access it from any device."
          }
        </p>
      </div>
    </div>
  );
}
