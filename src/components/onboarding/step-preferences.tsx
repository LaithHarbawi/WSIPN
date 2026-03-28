"use client";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useAppStore } from "@/contexts/app-store";
import {
  Sparkles,
  Palette,
  Gauge,
  Timer,
  Users,
  CalendarDays,
  Clock,
  Monitor,
  MessageSquare,
} from "lucide-react";
import {
  GENRE_OPTIONS,
  MOOD_OPTIONS,
  DIFFICULTY_OPTIONS,
  GAME_LENGTH_OPTIONS,
  PLAYER_MODE_OPTIONS,
  ERA_OPTIONS,
  TIME_COMMITMENT_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/lib/types";

interface MultiSelectProps {
  label: string;
  description?: string;
  icon: typeof Sparkles;
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  index: number;
}

function MultiSelect({
  label,
  description,
  icon: Icon,
  options,
  selected,
  onChange,
  index,
}: MultiSelectProps) {
  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div
      className="group space-y-4 opacity-0 animate-[fadeSlideIn_0.5s_ease-out_forwards]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-accent-primary/10 border border-accent-primary/20 shadow-sm shadow-accent-primary/5">
          <Icon className="h-4 w-4 text-accent-primary" />
        </div>
        <div className="space-y-0.5 pt-1">
          <h3 className="text-sm font-bold text-text-primary tracking-tight">
            {label}
          </h3>
          {description && (
            <p className="text-xs text-text-muted leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-12">
        {options.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={selected.includes(opt)}
            onToggle={() => toggle(opt)}
          />
        ))}
      </div>
    </div>
  );
}

interface SingleSelectProps {
  label: string;
  description?: string;
  icon: typeof Sparkles;
  options: readonly string[];
  selected: string;
  onChange: (value: string) => void;
  index: number;
}

function SingleSelect({
  label,
  description,
  icon: Icon,
  options,
  selected,
  onChange,
  index,
}: SingleSelectProps) {
  return (
    <div
      className="group space-y-4 opacity-0 animate-[fadeSlideIn_0.5s_ease-out_forwards]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-accent-primary/10 border border-accent-primary/20 shadow-sm shadow-accent-primary/5">
          <Icon className="h-4 w-4 text-accent-primary" />
        </div>
        <div className="space-y-0.5 pt-1">
          <h3 className="text-sm font-bold text-text-primary tracking-tight">
            {label}
          </h3>
          {description && (
            <p className="text-xs text-text-muted leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-12">
        {options.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={selected === opt}
            onToggle={() => onChange(opt)}
          />
        ))}
      </div>
    </div>
  );
}

export function StepPreferences() {
  const { preferences, updatePreference, setOnboardingStep } = useAppStore();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Keyframes for stagger animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Centered Header */}
      <div
        className="text-center space-y-3 pb-2 opacity-0 animate-[fadeSlideIn_0.5s_ease-out_forwards]"
      >
        <h2 className="text-3xl font-extrabold tracking-tight text-text-primary">
          What are you in the mood for?
        </h2>
        <p className="text-text-secondary text-base max-w-lg mx-auto leading-relaxed">
          This is about <em className="text-text-primary font-medium not-italic">right now</em>, not your permanent taste.
          What kind of experience are you looking for today?
        </p>
      </div>

      {/* Warm info box */}
      <div
        className="rounded-2xl bg-accent-warm/5 border border-accent-warm/15 px-5 py-4 opacity-0 animate-[fadeSlideIn_0.5s_ease-out_forwards]"
        style={{ animationDelay: "80ms" }}
      >
        <p className="text-sm text-accent-warm leading-relaxed text-center">
          These are broad preferences &mdash; we won&apos;t filter too strictly.
          Our system uses them as <strong className="font-semibold">guidance</strong>, not hard rules.
        </p>
      </div>

      {/* Selection fields */}
      <div className="space-y-10">
        <MultiSelect
          label="Genres"
          description="Select as many as you're interested in right now"
          icon={Sparkles}
          options={GENRE_OPTIONS}
          selected={preferences.genres}
          onChange={(v) => updatePreference("genres", v)}
          index={0}
        />

        <MultiSelect
          label="Mood & Vibe"
          description="What feeling are you chasing?"
          icon={Palette}
          options={MOOD_OPTIONS}
          selected={preferences.moods}
          onChange={(v) => updatePreference("moods", v)}
          index={1}
        />

        {/* Divider */}
        <div className="border-t border-border-subtle/60 mx-12" />

        <SingleSelect
          label="Difficulty"
          description="How much challenge do you want?"
          icon={Gauge}
          options={DIFFICULTY_OPTIONS}
          selected={preferences.difficulty}
          onChange={(v) => updatePreference("difficulty", v)}
          index={2}
        />

        <SingleSelect
          label="Game Length"
          description="How big of a time investment?"
          icon={Timer}
          options={GAME_LENGTH_OPTIONS}
          selected={preferences.gameLength}
          onChange={(v) => updatePreference("gameLength", v)}
          index={3}
        />

        <SingleSelect
          label="Player Mode"
          description="Solo adventure or multiplayer?"
          icon={Users}
          options={PLAYER_MODE_OPTIONS}
          selected={preferences.playerMode}
          onChange={(v) => updatePreference("playerMode", v)}
          index={4}
        />

        {/* Divider */}
        <div className="border-t border-border-subtle/60 mx-12" />

        <SingleSelect
          label="Era Preference"
          description="Classic, modern, or no preference?"
          icon={CalendarDays}
          options={ERA_OPTIONS}
          selected={preferences.era}
          onChange={(v) => updatePreference("era", v)}
          index={6}
        />

        <SingleSelect
          label="Session Time"
          description="How long do you have to play?"
          icon={Clock}
          options={TIME_COMMITMENT_OPTIONS}
          selected={preferences.timeCommitment}
          onChange={(v) => updatePreference("timeCommitment", v)}
          index={7}
        />

        <MultiSelect
          label="Platforms"
          description="Where will you be playing? Select all that apply."
          icon={Monitor}
          options={PLATFORM_OPTIONS}
          selected={preferences.platforms}
          onChange={(v) => updatePreference("platforms", v)}
          index={7}
        />

        {/* Divider */}
        <div className="border-t border-border-subtle/60 mx-12" />

        {/* Global Comment */}
        <div
          className="group space-y-4 opacity-0 animate-[fadeSlideIn_0.5s_ease-out_forwards]"
          style={{ animationDelay: `${9 * 60}ms` }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-accent-primary/10 border border-accent-primary/20 shadow-sm shadow-accent-primary/5">
              <MessageSquare className="h-4 w-4 text-accent-primary" />
            </div>
            <div className="space-y-0.5 pt-1">
              <h3 className="text-sm font-bold text-text-primary tracking-tight">
                Anything else?
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Tell us anything — specific things you love or hate, deal-breakers,
                a vibe you&apos;re chasing, or games you want &ldquo;more of&rdquo;. This directly shapes your results.
              </p>
            </div>
          </div>
          <div className="pl-12">
            <textarea
              value={preferences.globalComment}
              onChange={(e) => updatePreference("globalComment", e.target.value)}
              placeholder={'e.g. "I want something with a really good story that isn\'t too long. I loved the art style of Ori. No battle royales."'}
              rows={3}
              className="w-full rounded-xl bg-bg-tertiary/60 border border-border-subtle/60 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/40 resize-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Premium navigation footer */}
      <div className="flex items-center justify-between pt-6 pb-2 border-t border-border-subtle/60">
        <button
          onClick={() => setOnboardingStep(1)}
          className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors duration-200 px-3 py-2 -ml-3 rounded-lg hover:bg-surface-hover"
        >
          &larr; Back
        </button>
        <Button
          onClick={() => setOnboardingStep(3)}
          className="px-6 py-2.5 font-semibold shadow-lg shadow-accent-primary/20"
        >
          Review & Generate
        </Button>
      </div>
    </div>
  );
}
