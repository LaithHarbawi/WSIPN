"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateStoreLinks } from "@/lib/affiliate";
import {
  Users,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import type { GroupRecommendation } from "@/lib/group-merge";

interface StepResultsProps {
  recommendations: GroupRecommendation[];
  participantNames: string[];
  onRestart: () => void;
}

export function StepResults({
  recommendations,
  participantNames,
  onRestart,
}: StepResultsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 flex items-center justify-center mx-auto">
          <Users className="h-6 w-6 text-accent-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Group Recommendations
        </h2>
        <p className="text-text-secondary text-sm max-w-md mx-auto">
          {recommendations.length} games for{" "}
          {participantNames.join(", ")} to enjoy together.
        </p>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec, i) => {
          const isExpanded = expandedId === rec.id;
          const storeLinks = generateStoreLinks(rec.title, rec.platforms);

          return (
            <Card
              key={rec.id}
              variant="interactive"
              padding="none"
              className="overflow-hidden animate-fade-in-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="flex gap-4 p-4">
                {/* Cover image */}
                {rec.imageUrl ? (
                  <img
                    src={rec.imageUrl}
                    alt=""
                    className="w-20 h-28 rounded-xl object-cover flex-shrink-0 bg-bg-tertiary shadow-card"
                  />
                ) : (
                  <div className="w-20 h-28 rounded-xl bg-bg-tertiary flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-text-primary leading-tight">
                        {rec.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {rec.year && (
                          <span className="text-xs text-text-muted">
                            {rec.year}
                          </span>
                        )}
                        {rec.confidence && (
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                              rec.confidence === "High"
                                ? "bg-accent-success/10 text-accent-success"
                                : "bg-accent-primary/10 text-accent-primary"
                            }`}
                          >
                            {rec.confidence}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : rec.id)
                      }
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                    {rec.explanation}
                  </p>

                  {rec.genres?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {rec.genres.slice(0, 4).map((g) => (
                        <span
                          key={g}
                          className="text-[10px] font-medium uppercase tracking-wider text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded-md"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Expanded section */}
              <div
                className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isExpanded
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-3 border-t border-border-subtle/60 pt-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        Group Fit
                      </p>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {rec.groupFit}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        Possible Conflict
                      </p>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {rec.possibleConflict}
                      </p>
                    </div>

                    {/* Store links */}
                    {storeLinks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                          Get It
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {storeLinks.slice(0, 4).map((link) => (
                            <a
                              key={link.store}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary/60 hover:bg-bg-tertiary px-3 py-1.5 rounded-lg transition-all"
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
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <Button variant="secondary" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" />
          Start New Group Session
        </Button>
      </div>
    </div>
  );
}
