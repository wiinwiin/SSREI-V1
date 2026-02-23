import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'danger';
}

export function ShimmerButton({ children, variant = 'primary', className = '', disabled, ...props }: ShimmerButtonProps) {
  const base = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 shadow-red-200/60'
    : 'bg-[#1E6FA4] hover:bg-[#1a5f8e] shadow-blue-200/60';

  return (
    <button
      disabled={disabled}
      className={`
        relative inline-flex items-center justify-center gap-2
        px-6 py-3 rounded-xl font-body font-medium text-sm text-white
        shadow-lg overflow-hidden
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${!disabled ? base : 'bg-gray-400'}
        ${className}
      `}
      {...props}
    >
      {!disabled && (
        <span
          className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />
      )}
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}
