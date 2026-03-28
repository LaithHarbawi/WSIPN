"use client";

import { X } from "lucide-react";

interface ChipProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  variant?: "default" | "loved" | "liked" | "disliked";
  size?: "sm" | "md";
}

const variantColors = {
  default: {
    base: "border-border-medium text-text-muted hover:border-accent-primary/40 hover:text-text-secondary hover:bg-accent-primary/5",
    selected:
      "border-accent-primary/50 bg-accent-primary/10 text-accent-primary shadow-sm shadow-accent-primary/5",
  },
  loved: {
    base: "border-loved/20 text-text-muted hover:border-loved/40 hover:text-loved/80 hover:bg-loved/5",
    selected: "border-loved/40 bg-loved/10 text-loved shadow-sm shadow-loved/5",
  },
  liked: {
    base: "border-liked/20 text-text-muted hover:border-liked/40 hover:text-liked/80 hover:bg-liked/5",
    selected: "border-liked/40 bg-liked/10 text-liked shadow-sm shadow-liked/5",
  },
  disliked: {
    base: "border-disliked/20 text-text-muted hover:border-disliked/40 hover:text-disliked/80 hover:bg-disliked/5",
    selected:
      "border-disliked/40 bg-disliked/10 text-disliked shadow-sm shadow-disliked/5",
  },
};

export function Chip({
  label,
  selected,
  onToggle,
  onRemove,
  variant = "default",
  size = "md",
}: ChipProps) {
  const colors = variantColors[variant];
  const sizeClass =
    size === "sm"
      ? "px-2.5 py-0.5 text-xs rounded-lg"
      : "px-4 py-2 text-[13px] rounded-xl";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        inline-flex items-center gap-1.5 border font-medium
        transition-all duration-200 cubic-bezier(0.16,1,0.3,1)
        hover:scale-[1.03] active:scale-[0.96]
        ${sizeClass}
        ${selected ? colors.selected : colors.base}
        ${onToggle ? "cursor-pointer" : "cursor-default"}
      `}
    >
      {label}
      {onRemove && (
        <X
          className="h-3 w-3 opacity-50 hover:opacity-100 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </button>
  );
}
