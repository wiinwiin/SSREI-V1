import { Lead } from '../../types';
import { DispositionBadge } from '../DispositionBadge';
import { CollapsibleSection, DetailGrid, DetailItem, SubSection, ScoreBar, val, formatDate } from './DetailHelpers';

function parseScore(s: string | undefined): number {
  const n = parseInt(s || '0', 10);
  return isNaN(n) ? 0 : n;
}

function ScoreCard({ label, score, max, color, desc }: {
  label: string;
  score: number;
  max: number;
  color: string;
  desc: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
      <div className="flex items-center justify-between mb-1">
        <p className="font-body text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        {label.toLowerCase().includes('retail') && <span className="text-base">🔥</span>}
      </div>
      <p className="font-heading text-3xl text-gray-900 mt-1">{score > 0 ? score : '—'}</p>
      <ScoreBar score={score} max={max} color={color} />
      <p className="font-body text-xs text-gray-400 mt-2">{desc}</p>
    </div>
  );
}

export function OverviewSection({ lead }: { lead: Lead }) {
  const retailScore = parseScore(lead.retail_sellability_score);
  const rentalScore = parseScore(lead.rental_sellability_score);
  const wholesaleScore = parseScore(lead.wholesale_sellability_score);

  return (
    <CollapsibleSection id="overview" title="Overview" defaultOpen>
      <div className="space-y-8">
        <SubSection title="Deal Automator Insights">
          <DetailGrid cols={3}>
            <DetailItem label="Retail Value Estimate" value={lead.retail_value_estimate} />
            <DetailItem label="Rental Value Estimate" value={lead.rental_value_estimate} />
            <DetailItem label="Wholesale Value Estimate" value={lead.wholesale_value_estimate} />
          </DetailGrid>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <ScoreCard
              label="Retail Score"
              score={retailScore}
              max={1000}
              color="bg-blue-600"
              desc="Likelihood of selling retail on the MLS"
            />
            <ScoreCard
              label="Rental Score"
              score={rentalScore}
              max={1000}
              color="bg-emerald-500"
              desc="Likelihood of success as a rental investment"
            />
            <ScoreCard
              label="Wholesale Score"
              score={wholesaleScore}
              max={1000}
              color="bg-amber-500"
              desc="Likelihood of selling wholesale to investors"
            />
          </div>
        </SubSection>

        <SubSection title="Owner Insights">
          <DetailGrid cols={3}>
            <DetailItem label="Owner Name" value={lead.owner_name} />
            <DetailItem label="Phone" value={lead.phone} />
            <DetailItem label="Email" value={lead.email} />
            <DetailItem label="Owner Type" value={lead.owner_type} />
            <DetailItem label="Length of Ownership" value={lead.length_of_ownership} />
            <DetailItem label="Estimated Equity" value={lead.estimated_equity} />
            <DetailItem label="Absentee Owner" value={lead.absentee_owner} />
            <DetailItem label="Out of State Owner" value={lead.out_of_state_owner} />
            <DetailItem label="Mailing Address" value={lead.mailing_address} />
          </DetailGrid>
        </SubSection>

        <SubSection title="Call Disposition">
          <div className="space-y-5">
            <DetailGrid cols={3}>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 font-body">Disposition</p>
                <DispositionBadge disposition={lead.disposition} />
              </div>
              <DetailItem label="Follow Up Date" value={formatDate(lead.follow_up_date)} />
              <DetailItem label="Submitted By" value={lead.submitted_by} />
            </DetailGrid>
            {lead.notes && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 font-body">Notes</p>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="font-body text-sm text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              </div>
            )}
          </div>
        </SubSection>
      </div>
    </CollapsibleSection>
  );
}
