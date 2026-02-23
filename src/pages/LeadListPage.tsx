import { useState, useMemo } from 'react';
import { Search, Filter, PlusCircle, ChevronUp, ChevronDown, ArrowUpDown, Trash2, AlertTriangle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { DispositionBadge } from '../components/DispositionBadge';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { Toast } from '../components/Toast';
import { BorderBeam } from '../components/ui/BorderBeam';
import { ShimmerButton } from '../components/ui/ShimmerButton';
import { useLeads } from '../hooks/useLeads';
import { useRouter } from '../context/RouterContext';
import { deleteOpportunityFromGHL } from '../lib/ghl';
import { Lead, Disposition } from '../types';

type SortKey = 'property_address' | 'owner_name' | 'disposition' | 'follow_up_date' | 'submitted_by' | 'created_at';
type SortDir = 'asc' | 'desc';

function formatDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

const dispositions: Disposition[] = ['Customer Reached', 'No Answer', 'Left Voicemail', 'Callback Requested', 'Not Interested', 'Wrong Number', 'Follow Up', 'Bad Email', 'DNC'];

export function LeadListPage() {
  const { leads, loading, deleteLead } = useLeads();
  const { navigate } = useRouter();
  const [search, setSearch] = useState('');
  const [dispositionFilter, setDispositionFilter] = useState<Disposition | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let result = [...leads];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        l => l.property_address.toLowerCase().includes(q) || l.owner_name.toLowerCase().includes(q)
      );
    }
    if (dispositionFilter) result = result.filter(l => l.disposition === dispositionFilter);
    if (dateFrom) result = result.filter(l => l.follow_up_date && l.follow_up_date >= dateFrom);
    if (dateTo) result = result.filter(l => l.follow_up_date && l.follow_up_date <= dateTo);
    result.sort((a, b) => {
      const av = (a[sortKey] ?? '') as string;
      const bv = (b[sortKey] ?? '') as string;
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return result;
  }, [leads, search, dispositionFilter, dateFrom, dateTo, sortKey, sortDir]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.ghl_opportunity_id) {
        await deleteOpportunityFromGHL(deleteTarget.ghl_opportunity_id);
      }
      const success = await deleteLead(deleteTarget.id);
      if (success) {
        setToast({ message: `"${deleteTarget.owner_name} — ${deleteTarget.property_address}" deleted successfully.`, type: 'success' });
      } else {
        setToast({ message: 'Failed to delete the lead from the database.', type: 'error' });
      }
    } catch (err) {
      console.error('Delete error:', err);
      setToast({ message: 'Failed to delete from GoHighLevel. The lead was not removed.', type: 'error' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown size={13} className="text-gray-400 ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-[#1E6FA4] ml-1" />
      : <ChevronDown size={13} className="text-[#1E6FA4] ml-1" />;
  };

  const thClass = 'text-left px-5 py-3.5 font-body text-xs font-semibold text-gray-500 uppercase tracking-wider';
  const tdClass = 'px-5 py-4 font-body text-sm';

  return (
    <Layout
      title="Lead List"
      subtitle={`${filtered.length} lead${filtered.length !== 1 ? 's' : ''} found`}
      action={
        <ShimmerButton onClick={() => navigate('new-lead')}>
          <PlusCircle size={16} />
          Add Lead
        </ShimmerButton>
      }
    >
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by address or owner name..."
                className="w-full font-body text-sm pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E6FA4]/30 focus:border-[#1E6FA4] transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-body text-sm font-medium border transition-colors ${
                showFilters ? 'bg-blue-50 border-[#1E6FA4]/40 text-[#1E6FA4]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter size={15} />
              Filters
              {(dispositionFilter || dateFrom || dateTo) && (
                <span className="w-2 h-2 bg-[#1E6FA4] rounded-full" />
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-body text-xs font-medium text-gray-600 mb-1.5">Disposition</label>
                <select
                  value={dispositionFilter}
                  onChange={e => setDispositionFilter(e.target.value as Disposition | '')}
                  className="w-full font-body text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E6FA4]/30"
                >
                  <option value="">All Dispositions</option>
                  {dispositions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-body text-xs font-medium text-gray-600 mb-1.5">Follow Up From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full font-body text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E6FA4]/30"
                />
              </div>
              <div>
                <label className="block font-body text-xs font-medium text-gray-600 mb-1.5">Follow Up To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full font-body text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E6FA4]/30"
                />
              </div>
              {(dispositionFilter || dateFrom || dateTo) && (
                <button
                  onClick={() => { setDispositionFilter(''); setDateFrom(''); setDateTo(''); }}
                  className="font-body text-xs text-[#1E6FA4] hover:underline text-left"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex gap-4">
                  <div className="flex-1 h-12 bg-gray-100 rounded-lg animate-pulse" />
                  <div className="w-32 h-12 bg-gray-100 rounded-lg animate-pulse" />
                  <div className="w-24 h-12 bg-gray-100 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Search size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="font-body text-sm text-gray-400">No leads match your search criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className={thClass}>
                      <button className="flex items-center hover:text-gray-700 transition-colors" onClick={() => handleSort('property_address')}>
                        Property Address <SortIcon k="property_address" />
                      </button>
                    </th>
                    <th className={thClass}>
                      <button className="flex items-center hover:text-gray-700 transition-colors" onClick={() => handleSort('owner_name')}>
                        Owner Name <SortIcon k="owner_name" />
                      </button>
                    </th>
                    <th className={thClass}>
                      <button className="flex items-center hover:text-gray-700 transition-colors" onClick={() => handleSort('disposition')}>
                        Disposition <SortIcon k="disposition" />
                      </button>
                    </th>
                    <th className={thClass}>
                      <button className="flex items-center hover:text-gray-700 transition-colors" onClick={() => handleSort('follow_up_date')}>
                        Follow Up <SortIcon k="follow_up_date" />
                      </button>
                    </th>
                    <th className={thClass}>
                      <button className="flex items-center hover:text-gray-700 transition-colors" onClick={() => handleSort('submitted_by')}>
                        Submitted By <SortIcon k="submitted_by" />
                      </button>
                    </th>
                    <th className={`${thClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead: Lead, i) => (
                    <tr
                      key={lead.id}
                      className={`group transition-colors border-b border-gray-100 last:border-0 ${
                        i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                      } hover:bg-blue-50/50`}
                    >
                      <td
                        className={`${tdClass} cursor-pointer`}
                        onClick={() => navigate('lead-detail', lead.id)}
                      >
                        <p className="font-medium text-gray-900 group-hover:text-[#1E6FA4] transition-colors">{lead.property_address}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{lead.city}{lead.city && lead.state ? ', ' : ''}{lead.state} {lead.zip}</p>
                      </td>
                      <td
                        className={`${tdClass} cursor-pointer`}
                        onClick={() => navigate('lead-detail', lead.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700">{lead.owner_name}</span>
                          {lead.dnc && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold font-body bg-red-600 text-white">
                              <AlertTriangle size={9} />
                              DNC
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={`${tdClass} cursor-pointer`}
                        onClick={() => navigate('lead-detail', lead.id)}
                      >
                        <DispositionBadge disposition={lead.disposition} />
                      </td>
                      <td
                        className={`${tdClass} text-gray-600 cursor-pointer`}
                        onClick={() => navigate('lead-detail', lead.id)}
                      >
                        {formatDate(lead.follow_up_date)}
                      </td>
                      <td
                        className={`${tdClass} text-gray-600 cursor-pointer`}
                        onClick={() => navigate('lead-detail', lead.id)}
                      >
                        {lead.submitted_by}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(lead); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-body font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Delete lead"
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.slice(0, 3).map(lead => (
              <div
                key={`card-${lead.id}`}
                className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                onClick={() => navigate('lead-detail', lead.id)}
              >
                <BorderBeam size={100} duration={12} />
                <p className="font-body text-xs font-semibold text-[#1E6FA4] uppercase tracking-wider mb-1">{lead.home_type || 'Lead'}</p>
                <p className="font-heading text-base text-gray-900 mb-0.5 truncate">{lead.property_address}</p>
                <div className="flex items-center gap-2 mb-3">
                  <p className="font-body text-sm text-gray-500 truncate">{lead.owner_name}</p>
                  {lead.dnc && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold font-body bg-red-600 text-white">
                      <AlertTriangle size={9} />
                      DNC
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <DispositionBadge disposition={lead.disposition} />
                  {lead.ghl_contact_id && (
                    <span className="font-body text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">GHL Synced</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        leadName={deleteTarget ? `${deleteTarget.owner_name} — ${deleteTarget.property_address}` : ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </Layout>
  );
}
