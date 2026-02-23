import { CollapsibleSection, EmptyState } from './DetailHelpers';

export function ComparablesSection() {
  return (
    <CollapsibleSection id="comparables" title="Comparables" defaultOpen={false}>
      <EmptyState message="Comparable properties will be displayed here." />
    </CollapsibleSection>
  );
}
