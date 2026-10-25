import type { ReactElement } from 'react';

export function Logo({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
}): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M 16 74 A 44 44 0 0 1 84 26"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 26 86 C 28 78 32 70 36 62 C 40 54 44 46 48 38 C 52 30 56 22 60 16 C 62 14 64 13 66 14 L 68 18 C 64 22 60 30 56 38 C 52 46 48 54 44 62 C 40 70 36 78 32 84 C 30 86 28 87 26 86 Z"
        fill="currentColor"
      />
      <line x1="28" y1="84" x2="64" y2="16" stroke="white" strokeWidth="1" strokeLinecap="round" />
      <line
        x1="32"
        y1="76"
        x2="26"
        y2="70"
        stroke="white"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <line
        x1="36"
        y1="70"
        x2="28"
        y2="62"
        stroke="white"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <line
        x1="40"
        y1="64"
        x2="30"
        y2="54"
        stroke="white"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <line
        x1="44"
        y1="58"
        x2="32"
        y2="46"
        stroke="white"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <line
        x1="48"
        y1="52"
        x2="36"
        y2="38"
        stroke="white"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <line
        x1="52"
        y1="46"
        x2="40"
        y2="30"
        stroke="white"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <line
        x1="56"
        y1="40"
        x2="44"
        y2="22"
        stroke="white"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <line
        x1="60"
        y1="34"
        x2="48"
        y2="16"
        stroke="white"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
