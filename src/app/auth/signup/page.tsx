"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { WsipnLogo } from "@/components/ui/wsipn-logo";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || undefined },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-accent-success/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-accent-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Check your email</h2>
          <p className="text-sm text-text-secondary">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account.
          </p>
          <p className="text-xs text-text-muted">
            After confirming, you&apos;ll be taken straight to building your taste profile.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => router.push("/auth/signin")}>
              Sign In
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/onboarding")}>
              Continue as guest for now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-8">
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <WsipnLogo size={40} className="shadow-lg shadow-accent-primary/20" />
          </Link>
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-text-secondary">
            Save your taste profile and access it anywhere
          </p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <Input
            label="Display Name"
            type="text"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
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
            placeholder="At least 6 characters"
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
            Create Account
          </Button>
        </form>

        <div className="text-center space-y-3">
          <p className="text-sm text-text-muted">
            Already have an account?{" "}
            <Link
              href="/auth/signin"
              className="text-accent-primary hover:underline"
            >
              Sign in
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
