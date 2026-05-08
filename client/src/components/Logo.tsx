interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 36, className = '' }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="logo-warm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF8C42" />
          <stop offset="100%" stopColor="#FFD166" />
        </linearGradient>
      </defs>

      {/* Warm gradient squircle background */}
      <rect width="64" height="64" rx="20" fill="url(#logo-warm-grad)" />

      {/* Rounded 5-pointed star — control points are the sharp tips,
          bezier curves naturally round them without complex math */}
      <path
        d="M37.9 23.9 Q53 25 41.5 35 Q45 50 32 42 Q19 50 22.5 35 Q11 25 26.1 23.9 Q32 10 37.9 23.9Z"
        fill="white"
        opacity="0.95"
      />

      {/* Tiny circle at center for depth */}
      <circle cx="32" cy="32" r="4.5" fill="url(#logo-warm-grad)" opacity="0.6" />
    </svg>
  );
}
