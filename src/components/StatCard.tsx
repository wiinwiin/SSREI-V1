import { LucideIcon } from 'lucide-react';
import { NumberTicker } from './ui/NumberTicker';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: 'blue' | 'teal' | 'amber' | 'red' | 'gray';
  description?: string;
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-[#1E6FA4] text-white',
    value: 'text-[#1E6FA4]',
    border: 'border-blue-100',
  },
  teal: {
    bg: 'bg-teal-50',
    icon: 'bg-teal-600 text-white',
    value: 'text-teal-700',
    border: 'border-teal-100',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'bg-amber-500 text-white',
    value: 'text-amber-700',
    border: 'border-amber-100',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'bg-red-600 text-white',
    value: 'text-red-700',
    border: 'border-red-100',
  },
  gray: {
    bg: 'bg-gray-50',
    icon: 'bg-gray-500 text-white',
    value: 'text-gray-700',
    border: 'border-gray-200',
  },
};

export function StatCard({ label, value, icon: Icon, color, description }: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className={`bg-white rounded-xl border ${c.border} shadow-sm p-6 flex items-start gap-4 hover:shadow-md transition-shadow`}>
      <div className={`w-12 h-12 rounded-xl ${c.icon} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="font-body text-sm text-gray-500 font-medium">{label}</p>
        <p className={`font-heading text-3xl font-bold mt-1 ${c.value}`}>
          {typeof value === 'number' ? (
            <NumberTicker value={value} />
          ) : (
            value
          )}
        </p>
        {description && <p className="font-body text-xs text-gray-400 mt-1">{description}</p>}
      </div>
    </div>
  );
}
