"use client";

interface WsipnLogoProps {
  size?: number;
  className?: string;
}

/**
 * Custom WSIPN logo — a stylized play-button / compass hybrid
 * that evokes "finding your next game".
 */
export function WsipnLogo({ size = 36, className = "" }: WsipnLogoProps) {
  return (
    <div
      className={`relative rounded-xl bg-gradient-accent flex items-center justify-center shadow-card group-hover:shadow-elevated transition-shadow duration-300 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer compass ring */}
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="white"
          strokeWidth="1.5"
          strokeOpacity="0.5"
        />
        {/* Inner play triangle — slightly offset right for visual balance */}
        <path
          d="M9.5 7.2 L17.5 12 L9.5 16.8Z"
          fill="white"
          fillOpacity="0.95"
        />
        {/* Compass dot top */}
        <circle cx="12" cy="3" r="1.2" fill="white" fillOpacity="0.7" />
      </svg>
    </div>
  );
}
