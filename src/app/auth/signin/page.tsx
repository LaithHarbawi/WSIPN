"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/contexts/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { WsipnLogo } from "@/components/ui/wsipn-logo";

export default function SignInPage() {
  const router = useRouter();
  const { setUserMode } = useAppStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        setError(signInError.message);
      } else if (data.user) {
        setUserMode("authenticated", data.user.id);
        // Check if user has completed onboarding (has any games)
        const profileRaw = localStorage.getItem("wsipn_taste_profile");
        const step = localStorage.getItem("wsipn_onboarding_step");
        const hasGames = profileRaw && JSON.parse(profileRaw) &&
          (JSON.parse(profileRaw).loved?.length > 0 ||
           JSON.parse(profileRaw).liked?.length > 0 ||
           JSON.parse(profileRaw).disliked?.length > 0);
        const completedOnboarding = step && parseInt(step) >= 3;

        if (hasGames || completedOnboarding) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-8">
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <WsipnLogo size={40} className="shadow-lg shadow-accent-primary/20" />
          </Link>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-text-secondary">
            Sign in to access your taste profile
          </p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="rounded-lg bg-accent-danger/10 border border-accent-danger/20 px-4 py-3 text-sm text-accent-danger">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>

        <div className="text-center space-y-3">
          <p className="text-sm text-text-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-accent-primary hover:underline"
            >
              Sign up
            </Link>
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Continue as guest instead
          </Link>
        </div>
      </div>
    </div>
  );
}
