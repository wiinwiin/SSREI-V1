import { Lead } from '../../types';
import { CollapsibleSection, EmptyState, val } from './DetailHelpers';

interface LoanRecord {
  amount: string;
  loanType: string;
  term: string;
  rateType: string;
  interestRate: string;
  recordingDate: string;
  maturityDate: string;
  lender: string;
}

function deriveLoanSummary(lead: Lead) {
  const hasData = lead.mortgage_amount || lead.mortgage_balance;
  if (!hasData) return null;

  return {
    openLoans: lead.mortgage_amount ? 1 : 0,
    totalAmount: lead.mortgage_amount || '—',
    estimatedBalance: lead.mortgage_balance || '—',
    ltv: lead.ltv || '—',
  };
}

function deriveLoanHistory(lead: Lead): LoanRecord[] {
  if (!lead.mortgage_amount && !lead.mortgage_balance) return [];
  return [
    {
      amount: val(lead.mortgage_amount),
      loanType: '—',
      term: '—',
      rateType: '—',
      interestRate: '—',
      recordingDate: val(lead.last_sale_date),
      maturityDate: '—',
      lender: '—',
    },
  ];
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
      <p className="font-body text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="font-heading text-xl text-gray-900">{value}</p>
    </div>
  );
}

export function LoansSection({ lead }: { lead: Lead }) {
  const summary = deriveLoanSummary(lead);
  const history = deriveLoanHistory(lead);

  return (
    <CollapsibleSection id="loans" title="Loans" defaultOpen={false}>
      {!summary ? (
        <EmptyState message="No loan data available." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Open Loans" value={String(summary.openLoans)} />
            <SummaryCard label="Total Amount" value={summary.totalAmount} />
            <SummaryCard label="Est. Balance" value={summary.estimatedBalance} />
            <SummaryCard label="LTV" value={summary.ltv} />
          </div>

          {history.length > 0 && (
            <div>
              <h3 className="font-body text-xs font-semibold text-gray-500 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Loan History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Amount', 'Loan Type', 'Term', 'Rate Type', 'Interest Rate', 'Recording Date', 'Maturity Date', 'Lender'].map(h => (
                        <th key={h} className="text-left py-2 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-6 text-gray-800 font-medium whitespace-nowrap">{row.amount}</td>
                        <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.loanType}</td>
                        <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.term}</td>
                        <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.rateType}</td>
                        <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.interestRate}</td>
                        <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.recordingDate}</td>
                        <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.maturityDate}</td>
                        <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.lender}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
