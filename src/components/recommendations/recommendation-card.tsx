"use client";

import { useState, useMemo } from "react";
import {
  Bookmark,
  Ban,
  Gamepad2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  Zap,
  Shield,
  HelpCircle,
  ExternalLink,
  ShoppingCart,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { generateStoreLinks, type StoreLink } from "@/lib/affiliate";
import type {
  Recommendation,
  RecommendationType,
  RecommendationFeedback,
} from "@/lib/types";

const TYPE_META: Record<
  RecommendationType,
  { label: string; icon: typeof Sparkles; color: string; bgColor: string }
> = {
  primary: {
    label: "Top Pick",
    icon: Sparkles,
    color: "text-accent-primary",
    bgColor: "bg-accent-primary/10",
  },
  wildcard: {
    label: "Wildcard",
    icon: Zap,
    color: "text-accent-warm",
    bgColor: "bg-accent-warm/10",
  },
  safe_pick: {
    label: "Safe Pick",
    icon: Shield,
    color: "text-accent-success",
    bgColor: "bg-accent-success/10",
  },
  surprise: {
    label: "Surprise",
    icon: HelpCircle,
    color: "text-accent-secondary",
    bgColor: "bg-accent-secondary/10",
  },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-accent-success/15 text-accent-success border-accent-success/20",
  medium: "bg-accent-warm/15 text-accent-warm border-accent-warm/20",
  low: "bg-accent-danger/15 text-accent-danger border-accent-danger/20",
};

function getConfidenceStyle(confidence?: string): string {
  if (!confidence) return "";
  const key = confidence.toLowerCase();
  return CONFIDENCE_COLORS[key] ?? "bg-accent-primary/15 text-accent-primary border-accent-primary/20";
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  featured?: boolean;
  onFeedback?: (type: RecommendationFeedback) => void;
}

export function RecommendationCard({
  recommendation: rec,
  featured,
  onFeedback,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(featured ?? false);
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
  const meta = TYPE_META[rec.type];

  const storeLinks = useMemo(
    () => generateStoreLinks(rec.title, rec.platforms),
    [rec.title, rec.platforms]
  );

  const handleFeedback = (type: RecommendationFeedback) => {
    setFeedbackGiven(type);
    onFeedback?.(type);
  };

  const heroImage = rec.screenshotUrl || rec.imageUrl;

  if (featured) {
    return (
      <Card
        variant="elevated"
        padding="none"
        className="overflow-hidden transition-all duration-300 glow-sm"
      >
        {/* Hero banner — 16:9 screenshot */}
        <div className="relative aspect-video w-full overflow-hidden">
          {heroImage ? (
            <img
              src={heroImage}
              alt={rec.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
              <Gamepad2 className="h-12 w-12 text-text-muted" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Floating type badge */}
          <div
            className={`absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${meta.bgColor} ${meta.color} backdrop-blur-md border border-white/10`}
          >
            <meta.icon className="h-3.5 w-3.5" />
            {meta.label}
          </div>

          {/* Title overlay on hero */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h3 className="text-2xl font-bold text-white drop-shadow-lg">
              {rec.title}
            </h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {rec.year && (
                <span className="text-sm text-white/70">{rec.year}</span>
              )}
              {rec.metacritic && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    rec.metacritic >= 75
                      ? "bg-accent-success/20 text-accent-success"
                      : rec.metacritic >= 50
                      ? "bg-accent-warm/20 text-accent-warm"
                      : "bg-accent-danger/20 text-accent-danger"
                  }`}
                >
                  {rec.metacritic}
                </span>
              )}
              {rec.confidence && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getConfidenceStyle(rec.confidence)}`}
                >
                  {rec.confidence} match
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content below hero */}
        <div className="p-6 space-y-4">
          {/* Genre pills */}
          {rec.genres?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {rec.genres.slice(0, 5).map((genre) => (
                <span
                  key={genre}
                  className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-bg-tertiary text-text-muted border border-border-subtle"
                >
                  {genre}
                </span>
              ))}
            </div>
          ) : null}

          {/* Explanation */}
          <p className="text-sm text-text-secondary leading-relaxed">
            {rec.explanation}
          </p>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show details
              </>
            )}
          </button>

          {/* Expanded details */}
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expanded
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-3 pt-1">
                {/* Why this matches */}
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-accent-success mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-accent-success mb-0.5">
                      Why this matches you
                    </p>
                    <p className="text-sm text-text-secondary">
                      {rec.whyMatches}
                    </p>
                  </div>
                </div>

                {/* Possible risk */}
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-accent-warm mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-accent-warm mb-0.5">
                      Possible risk
                    </p>
                    <p className="text-sm text-text-secondary">
                      {rec.possibleRisk}
                    </p>
                  </div>
                </div>

                {/* Platforms */}
                {rec.platforms?.length ? (
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span className="font-medium">Available on:</span>
                    <span>{rec.platforms.join(", ")}</span>
                  </div>
                ) : null}

                {/* Store links */}
                {storeLinks.length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShoppingCart className="h-3.5 w-3.5 text-text-muted" />
                      <span className="text-xs font-medium text-text-muted">
                        Get It
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {storeLinks.map((link: StoreLink) => (
                        <a
                          key={link.store}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-tertiary text-text-secondary border border-border-subtle hover:border-border-medium hover:text-text-primary hover:bg-bg-card-hover transition-all"
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: link.color }}
                          />
                          {link.store}
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
            <ActionButton
              active={feedbackGiven === "save"}
              activeColor="accent-primary"
              onClick={() => handleFeedback("save")}
              icon={Bookmark}
              label={feedbackGiven === "save" ? "Saved" : "Play Later"}
            />
            <ActionButton
              active={feedbackGiven === "already_played"}
              activeColor="accent-warm"
              onClick={() => handleFeedback("already_played")}
              icon={Gamepad2}
              label="Already Played"
            />
            <ActionButton
              active={feedbackGiven === "not_interested"}
              activeColor="accent-danger"
              onClick={() => handleFeedback("not_interested")}
              icon={Ban}
              label="Not Interested"
            />
            <ActionButton
              active={feedbackGiven === "more_like_this"}
              activeColor="accent-success"
              onClick={() => handleFeedback("more_like_this")}
              icon={Sparkles}
              label="More Like This"
            />
          </div>
        </div>
      </Card>
    );
  }

  // ── Normal (non-featured) card ──
  return (
    <Card
      variant="gradient"
      padding="none"
      className="overflow-hidden transition-all duration-300"
    >
      <div className="flex flex-row">
        {/* Cover art — portrait ratio (3:4) */}
        <div className="relative w-32 sm:w-40 flex-shrink-0">
          <div className="aspect-[3/4] relative overflow-hidden">
            {rec.imageUrl ? (
              <img
                src={rec.imageUrl}
                alt={rec.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-bg-tertiary flex items-center justify-center">
                <Gamepad2 className="h-8 w-8 text-text-muted" />
              </div>
            )}
            {/* Floating type badge */}
            <div
              className={`absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${meta.bgColor} ${meta.color} backdrop-blur-md border border-white/10`}
            >
              <meta.icon className="h-3 w-3" />
              {meta.label}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 space-y-3 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-text-primary truncate">
                {rec.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {rec.year && (
                  <span className="text-xs text-text-muted">{rec.year}</span>
                )}
                {rec.metacritic && (
                  <span
                    className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                      rec.metacritic >= 75
                        ? "bg-accent-success/15 text-accent-success"
                        : rec.metacritic >= 50
                        ? "bg-accent-warm/15 text-accent-warm"
                        : "bg-accent-danger/15 text-accent-danger"
                    }`}
                  >
                    {rec.metacritic}
                  </span>
                )}
                {rec.confidence && (
                  <span
                    className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${getConfidenceStyle(rec.confidence)}`}
                  >
                    {rec.confidence}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors flex-shrink-0"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Genre pills */}
          {rec.genres?.length ? (
            <div className="flex flex-wrap gap-1">
              {rec.genres.slice(0, 4).map((genre) => (
                <span
                  key={genre}
                  className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-bg-tertiary text-text-muted"
                >
                  {genre}
                </span>
              ))}
            </div>
          ) : null}

          {/* Explanation */}
          <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
            {rec.explanation}
          </p>

          {/* Expanded details */}
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expanded
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-3 pt-1">
                {/* Why this matches */}
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-accent-success mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-accent-success mb-0.5">
                      Why this matches you
                    </p>
                    <p className="text-sm text-text-secondary">
                      {rec.whyMatches}
                    </p>
                  </div>
                </div>

                {/* Possible risk */}
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-accent-warm mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-accent-warm mb-0.5">
                      Possible risk
                    </p>
                    <p className="text-sm text-text-secondary">
                      {rec.possibleRisk}
                    </p>
                  </div>
                </div>

                {/* Platforms */}
                {rec.platforms?.length ? (
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span className="font-medium">Available on:</span>
                    <span>{rec.platforms.join(", ")}</span>
                  </div>
                ) : null}

                {/* Store links */}
                {storeLinks.length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShoppingCart className="h-3.5 w-3.5 text-text-muted" />
                      <span className="text-xs font-medium text-text-muted">
                        Get It
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {storeLinks.map((link: StoreLink) => (
                        <a
                          key={link.store}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-bg-tertiary text-text-secondary border border-border-subtle hover:border-border-medium hover:text-text-primary hover:bg-bg-card-hover transition-all"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: link.color }}
                          />
                          {link.store}
                          <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <ActionButton
              active={feedbackGiven === "save"}
              activeColor="accent-primary"
              onClick={() => handleFeedback("save")}
              icon={Bookmark}
              label={feedbackGiven === "save" ? "Saved" : "Play Later"}
            />
            <ActionButton
              active={feedbackGiven === "already_played"}
              activeColor="accent-warm"
              onClick={() => handleFeedback("already_played")}
              icon={Gamepad2}
              label="Already Played"
            />
            <ActionButton
              active={feedbackGiven === "not_interested"}
              activeColor="accent-danger"
              onClick={() => handleFeedback("not_interested")}
              icon={Ban}
              label="Not Interested"
            />
            <ActionButton
              active={feedbackGiven === "more_like_this"}
              activeColor="accent-success"
              onClick={() => handleFeedback("more_like_this")}
              icon={Sparkles}
              label="More Like This"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Reusable action button ──

function ActionButton({
  active,
  activeColor,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  activeColor: string;
  onClick: () => void;
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
        active
          ? `bg-${activeColor}/20 text-${activeColor} scale-[1.02]`
          : "text-text-muted hover:text-text-primary hover:bg-bg-tertiary active:scale-95"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
