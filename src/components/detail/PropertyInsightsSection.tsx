import { Lead } from '../../types';
import { CollapsibleSection, DetailGrid, DetailItem, SubSection } from './DetailHelpers';

export function PropertyInsightsSection({ lead }: { lead: Lead }) {
  return (
    <CollapsibleSection id="property-insights" title="Property Insights" defaultOpen>
      <div className="space-y-8">
        <SubSection title="Property Details">
          <DetailGrid cols={3}>
            <DetailItem label="Property Address" value={lead.property_address} />
            <DetailItem label="City" value={lead.city} />
            <DetailItem label="State" value={lead.state} />
            <DetailItem label="Zip" value={lead.zip} />
            <DetailItem label="Home Type" value={lead.home_type} />
            <DetailItem label="Square Feet" value={lead.square_feet} />
            <DetailItem label="Beds" value={lead.beds} />
            <DetailItem label="Baths" value={lead.baths} />
            <DetailItem label="Stories" value={lead.stories} />
            <DetailItem label="Units" value={lead.units} />
            <DetailItem label="County" value={lead.county} />
            <DetailItem label="Zoning" value={lead.zoning} />
            <DetailItem label="Parcel Number" value={lead.parcel_number} />
            <DetailItem label="Lot Size" value={lead.lot_size} />
            <DetailItem label="HOA" value={lead.hoa} />
          </DetailGrid>
        </SubSection>

        <SubSection title="Financial Insights">
          <DetailGrid cols={3}>
            <DetailItem label="Property Taxes" value={lead.property_taxes} />
            <DetailItem label="Last Sale Date" value={lead.last_sale_date} />
            <DetailItem label="Last Sale Price" value={lead.last_sale_price} />
            <DetailItem label="Mortgage Amount" value={lead.mortgage_amount} />
            <DetailItem label="Mortgage Balance" value={lead.mortgage_balance} />
            <DetailItem label="LTV" value={lead.ltv} />
            <DetailItem label="AVM" value={lead.avm} />
            <DetailItem label="Rental Value" value={lead.rental_value} />
            <DetailItem label="Assessed Value" value={lead.assessed_value} />
          </DetailGrid>
        </SubSection>
      </div>
    </CollapsibleSection>
  );
}
