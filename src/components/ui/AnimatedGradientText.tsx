import { ReactNode } from 'react';

interface AnimatedGradientTextProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedGradientText({ children, className = '' }: AnimatedGradientTextProps) {
  return (
    <span
      className={`bg-gradient-to-r from-[#1E6FA4] via-[#38a0d4] to-[#0e4d7a] bg-[length:200%_auto] animate-gradient-shift bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  );
}
