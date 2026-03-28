"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-3 rounded-xl
            bg-bg-input border border-border-subtle
            text-text-primary placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary/60
            transition-all duration-200
            ${error ? "border-accent-danger/50 focus:ring-accent-danger/40" : ""}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-accent-danger">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
