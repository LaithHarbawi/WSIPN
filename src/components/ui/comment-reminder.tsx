"use client";

import { useState, useEffect } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import type { TasteProfile } from "@/lib/types";

interface CommentReminderProps {
  tasteProfile: TasteProfile;
}

export function CommentReminder({ tasteProfile }: CommentReminderProps) {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  const lovedWithoutComments = tasteProfile.loved.filter((g) => !g.comment);
  const dislikedWithoutComments = tasteProfile.disliked.filter(
    (g) => !g.comment
  );
  const count = lovedWithoutComments.length + dislikedWithoutComments.length;
  const totalImportant = tasteProfile.loved.length + tasteProfile.disliked.length;

  // Only show if there are uncommented loved/disliked games and at least 2 total
  const shouldShow = !dismissed && count > 0 && totalImportant >= 2;

  useEffect(() => {
    if (shouldShow) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [shouldShow]);

  if (!shouldShow) return null;

  const games = [...lovedWithoutComments, ...dislikedWithoutComments];
  const previewNames = games.slice(0, 2).map((g) => g.title);
  const remaining = games.length - previewNames.length;

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border border-accent-primary/12 bg-accent-primary/[0.03]
        transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}
      `}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="w-8 h-8 rounded-xl bg-accent-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MessageSquarePlus className="h-4 w-4 text-accent-primary/80" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text-primary">
            Add comments for better results
          </p>
          <p className="text-[12px] text-text-secondary mt-0.5 leading-relaxed">
            <span className="text-text-primary font-medium">{previewNames.join(", ")}</span>
            {remaining > 0 && ` + ${remaining} more`}
            {" "}&mdash; tell us <em>why</em> you{" "}
            {lovedWithoutComments.length > 0 ? "loved" : "disliked"} them.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary/60 transition-all duration-200 flex-shrink-0 -mt-0.5 -mr-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
