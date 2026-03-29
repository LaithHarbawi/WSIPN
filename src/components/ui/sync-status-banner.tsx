"use client";

import { Cloud, CloudOff, AlertTriangle, LoaderCircle } from "lucide-react";
import { useAppStore } from "@/contexts/app-store";

const TABLE_LABELS: Record<string, string> = {
  user_data: "profile mirror",
  saved_games: "saved games",
  user_title_feedback: "feedback sync",
  recommendation_sessions: "session history",
  recommendation_results: "recommendation history",
  game_entries: "taste profile",
  user_settings: "preferences and onboarding progress",
};

interface SyncStatusBannerProps {
  compactWhenHealthy?: boolean;
}

export function SyncStatusBanner({
  compactWhenHealthy = false,
}: SyncStatusBannerProps) {
  const { userMode, remoteSyncStatus, remoteSyncTables } = useAppStore();

  if (userMode !== "authenticated") return null;

  if (remoteSyncStatus === "unknown") {
    return (
      <div className="glass rounded-2xl border border-border-subtle px-4 py-3 flex items-center gap-3 text-sm text-text-secondary">
        <LoaderCircle className="h-4 w-4 text-accent-primary animate-spin" />
        <span>Checking account sync status…</span>
      </div>
    );
  }

  if (remoteSyncStatus === "healthy") {
    if (compactWhenHealthy) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-accent-success/20 bg-accent-success/[0.06] px-3.5 py-1.5 text-xs font-medium text-text-secondary">
          <Cloud className="h-3.5 w-3.5 text-accent-success flex-shrink-0" />
          <span className="text-text-primary">Syncing to your account</span>
        </div>
      );
    }

    return (
      <div className="glass rounded-2xl border border-accent-success/20 bg-accent-success/[0.05] px-4 py-3 flex items-center gap-3 text-sm">
        <Cloud className="h-4 w-4 text-accent-success flex-shrink-0" />
        <div>
          <p className="font-medium text-text-primary">Account sync is active.</p>
          <p className="text-text-muted text-xs mt-0.5">
            Your saved data is syncing with your account.
          </p>
        </div>
      </div>
    );
  }

  const affectedAreas =
    remoteSyncTables
      .map((table) => TABLE_LABELS[table] ?? table)
      .join(", ") || "account sync";

  return (
    <div
      className={`glass rounded-2xl px-4 py-3 flex items-start gap-3 text-sm ${
        remoteSyncStatus === "offline"
          ? "border border-accent-danger/20 bg-accent-danger/[0.05]"
          : "border border-accent-warm/20 bg-accent-warm/[0.05]"
      }`}
    >
      {remoteSyncStatus === "offline" ? (
        <CloudOff className="h-4 w-4 text-accent-danger flex-shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-accent-warm flex-shrink-0 mt-0.5" />
      )}
      <div>
        <p className="font-medium text-text-primary">
          {remoteSyncStatus === "offline"
            ? "Account sync is unavailable."
            : "Account sync is partially degraded."}
        </p>
        <p className="text-text-muted text-xs mt-0.5 leading-relaxed">
          The app is still working with browser-local data right now, but these areas may not sync across devices until the Supabase schema is fully up to date: {affectedAreas}.
        </p>
      </div>
    </div>
  );
}
