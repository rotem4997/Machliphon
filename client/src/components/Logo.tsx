// Inline SVG logo component for מחליפון
// Two people with swap arrows representing substitute management

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
      <rect width="64" height="64" rx="16" fill="#2DD4A8" />
      <g transform="translate(12, 14)">
        {/* Left person */}
        <circle cx="10" cy="10" r="5" fill="white" opacity="0.9" />
        <path d="M10 17c-5 0-8 3-8 6v2h16v-2c0-3-3-6-8-6z" fill="white" opacity="0.9" />
        {/* Right person */}
        <circle cx="30" cy="10" r="5" fill="white" opacity="0.9" />
        <path d="M30 17c-5 0-8 3-8 6v2h16v-2c0-3-3-6-8-6z" fill="white" opacity="0.9" />
        {/* Swap arrows */}
        <path d="M16 28L24 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M22 25L25 28L22 31" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 34L16 34" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M18 37L15 34L18 31" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
