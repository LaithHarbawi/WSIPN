"use client";

import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "glass" | "gradient" | "interactive";
  padding?: "sm" | "md" | "lg" | "none";
}

const variantStyles = {
  default: "bg-bg-card border border-border-subtle shadow-card",
  elevated: "bg-bg-elevated border border-border-medium shadow-elevated",
  glass: "glass border border-border-subtle shadow-card",
  gradient: "bg-gradient-card border border-border-subtle shadow-card",
  interactive:
    "bg-bg-card border border-border-subtle shadow-card hover:border-border-medium hover:bg-bg-card-hover hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer will-change-transform",
};

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-7",
};

export function Card({
  variant = "default",
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-2xl transition-all duration-300 ease-out
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
