import React from 'react';

interface AppLogoProps {
  className?: string;
}

// SLATE's mark: an indigo gradient square (matching the primary action
// color used throughout -- indigo-600/500 buttons, focus rings) with a bold
// "S" monogram and a thin underline evoking a schedule/ruled line. Kept as
// inline SVG (not an <img> to a static file) so it always renders crisply
// and can inherit sizing from Tailwind classes wherever it's used.
export const AppLogo: React.FC<AppLogoProps> = ({ className = 'h-9 w-9' }) => (
  <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SLATE">
    <defs>
      <linearGradient id="appLogoGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#818cf8" />
        <stop offset="100%" stopColor="#4338ca" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="url(#appLogoGradient)" />
    <text
      x="32"
      y="41"
      textAnchor="middle"
      fontSize="30"
      fontWeight="700"
      fontFamily="Arial, Helvetica, sans-serif"
      fill="white"
    >
      S
    </text>
    <rect x="20" y="47" width="24" height="3.5" rx="1.75" fill="white" fillOpacity="0.55" />
  </svg>
);
