interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
}

export function BorderBeam({
  className = '',
  size: _size = 80,
  duration = 10,
  colorFrom = '#1E6FA4',
  colorTo = '#38a0d4',
}: BorderBeamProps) {
  return (
    <span
      className={`pointer-events-none absolute inset-0 rounded-xl overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0 rounded-xl"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${colorFrom} 10%, ${colorTo} 20%, transparent 30%)`,
          animation: `border-beam-spin ${duration}s linear infinite`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1px',
        }}
      />
      <style>{`
        @keyframes border-beam-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  );
}
