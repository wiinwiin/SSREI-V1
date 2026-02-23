import { CollapsibleSection, EmptyState } from './DetailHelpers';

export function PreForeclosuresSection() {
  return (
    <CollapsibleSection id="pre-foreclosures" title="Pre-Foreclosures" defaultOpen={false}>
      <EmptyState message="No pre-foreclosure data available." />
    </CollapsibleSection>
  );
}
