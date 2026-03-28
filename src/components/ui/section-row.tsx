"use client";

import type { ReactNode } from "react";

interface SectionRowProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
}

export function SectionRow({
  title,
  subtitle,
  icon,
  children,
  scrollable = false,
}: SectionRowProps) {
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between px-1">
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2.5">
            {icon}
            {title}
          </h2>
          {subtitle && (
            <p className="text-[13px] text-text-muted leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>
      {scrollable ? (
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory -mx-2 px-2">
            {children}
          </div>
          {/* Fade edges for scroll indication */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg-primary to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg-primary to-transparent" />
        </div>
      ) : (
        <div>{children}</div>
      )}
    </section>
  );
}
