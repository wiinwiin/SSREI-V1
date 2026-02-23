import { Lead } from '../../types';
import { CollapsibleSection, EmptyState, val } from './DetailHelpers';

interface Transaction {
  date: string;
  event: string;
  salePrice: string;
  loan: string;
  lender: string;
  buyer: string;
  seller: string;
}

function deriveTransactions(lead: Lead): Transaction[] {
  if (!lead.last_sale_date && !lead.last_sale_price) return [];
  return [
    {
      date: val(lead.last_sale_date),
      event: 'Sale',
      salePrice: val(lead.last_sale_price),
      loan: val(lead.mortgage_amount),
      lender: '—',
      buyer: val(lead.owner_name),
      seller: '—',
    },
  ];
}

export function TransactionsSection({ lead }: { lead: Lead }) {
  const transactions = deriveTransactions(lead);

  return (
    <CollapsibleSection id="transactions" title="Transactions" defaultOpen={false}>
      {transactions.length === 0 ? (
        <EmptyState message="No transaction data available." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Event', 'Sale Price', 'Loan', 'Lender', 'Buyer', 'Seller'].map(h => (
                  <th key={h} className="text-left py-2 pr-6 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.date}</td>
                  <td className="py-3 pr-6">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {row.event}
                    </span>
                  </td>
                  <td className="py-3 pr-6 text-gray-800 font-medium whitespace-nowrap">{row.salePrice}</td>
                  <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.loan}</td>
                  <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.lender}</td>
                  <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.buyer}</td>
                  <td className="py-3 pr-6 text-gray-600 whitespace-nowrap">{row.seller}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleSection>
  );
}
