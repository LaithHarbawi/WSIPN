"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-gradient-accent text-white shadow-lg shadow-accent-primary/15 hover:shadow-xl hover:shadow-accent-primary/20 hover:brightness-110 active:shadow-accent-primary/10 active:brightness-95",
  secondary:
    "bg-bg-tertiary text-text-primary border border-border-medium hover:bg-bg-card-hover hover:border-accent-primary/25 active:bg-bg-tertiary active:border-border-medium",
  ghost:
    "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/80 active:bg-bg-tertiary/60",
  danger:
    "bg-accent-danger/8 text-accent-danger border border-accent-danger/15 hover:bg-accent-danger/15 active:bg-accent-danger/10",
  accent:
    "bg-accent-primary/8 text-accent-primary border border-accent-primary/15 hover:bg-accent-primary/15 active:bg-accent-primary/10",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3.5 py-1.5 text-[13px] rounded-xl gap-1.5",
  md: "px-5 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-[15px] rounded-2xl gap-2",
  xl: "px-8 py-3.5 text-base rounded-2xl gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-semibold
          transition-all duration-200 ease-out cursor-pointer
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary
          disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
          active:scale-[0.97]
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-20"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-80"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
