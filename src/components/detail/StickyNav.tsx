import { useEffect, useState } from 'react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'property-insights', label: 'Property Insights' },
  { id: 'loans', label: 'Loans' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'pre-foreclosures', label: 'Pre-Foreclosures' },
  { id: 'comparables', label: 'Comparables' },
];

export function StickyNav() {
  const [active, setActive] = useState('overview');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 }
    );

    TABS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActive(id);
    }
  };

  return (
    <div className="sticky top-[73px] z-10 bg-white border-b border-gray-200 -mx-6 lg:-mx-8 px-6 lg:px-8 shadow-sm">
      <nav className="flex gap-0 overflow-x-auto no-scrollbar">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className={`
              flex-shrink-0 px-4 py-3 text-sm font-medium font-body border-b-2 transition-all whitespace-nowrap
              ${active === id
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
