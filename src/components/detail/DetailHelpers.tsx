import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function val(v: string | boolean | null | undefined): string {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) {
    const [y, m, day] = parts;
    return `${m}/${day}/${y}`;
  }
  return d;
}

export function DetailItem({ label, value, wide }: {
  label: string;
  value: string | boolean | null | undefined;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-full' : ''}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 font-body">{label}</p>
      <p className="text-sm text-gray-800 font-medium font-body">{val(value)}</p>
    </div>
  );
}

export function DetailGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: number }) {
  const colClass = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`grid grid-cols-1 ${colClass} gap-x-8 gap-y-5`}>
      {children}
    </div>
  );
}

interface CollapsibleSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}

export function CollapsibleSection({ id, title, children, defaultOpen = true, badge }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-36">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-lg text-gray-900">{title}</h2>
          {badge}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-6 py-5">{children}</div>}
    </div>
  );
}

export function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="font-body text-xs font-semibold text-gray-500 uppercase tracking-widest border-b border-gray-100 pb-2">{title}</h3>
      {children}
    </div>
  );
}

export function ScoreBar({ score, max = 1000, color }: { score: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-10">
      <p className="font-body text-sm text-gray-400">{message}</p>
    </div>
  );
}
