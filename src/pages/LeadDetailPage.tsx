import { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Loader2, Phone, AlertTriangle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { DispositionBadge } from '../components/DispositionBadge';
import { LeadFormPage } from './LeadFormPage';
import { useLeads } from '../hooks/useLeads';
import { useRouter } from '../context/RouterContext';
import { Lead } from '../types';
import { updateContactDNCInGHL } from '../lib/ghl';
import { StickyNav } from '../components/detail/StickyNav';
import { OverviewSection } from '../components/detail/OverviewSection';
import { PropertyInsightsSection } from '../components/detail/PropertyInsightsSection';
import { LoansSection } from '../components/detail/LoansSection';
import { TransactionsSection } from '../components/detail/TransactionsSection';
import { PreForeclosuresSection } from '../components/detail/PreForeclosuresSection';
import { ComparablesSection } from '../components/detail/ComparablesSection';

function DNCToggle({ phone, isDNC, syncing, onToggle }: {
  phone: string;
  isDNC: boolean;
  syncing: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {phone && (
        <div className="flex items-center gap-1.5 text-sm font-body text-gray-700">
          <Phone size={13} className="text-gray-400 flex-shrink-0" />
          <span>{phone}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        disabled={syncing}
        title={isDNC ? 'Remove DNC — click to allow calls' : 'Mark as Do Not Call'}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-body border transition-all ${
          isDNC
            ? 'bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700'
            : 'bg-white text-gray-500 border-gray-300 hover:border-red-300 hover:text-red-500'
        } ${syncing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {syncing ? (
          <Loader2 size={11} className="animate-spin" />
        ) : isDNC ? (
          <AlertTriangle size={11} />
        ) : null}
        {isDNC ? 'DO NOT CALL' : 'DNC'}
      </button>
    </div>
  );
}

export function LeadDetailPage({ leadId }: { leadId: string }) {
  const { getLeadById, updateLead } = useLeads();
  const { navigate } = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [dncSyncing, setDncSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await getLeadById(leadId);
      setLead(data);
      setLoading(false);
    })();
  }, [leadId, getLeadById]);

  const handleToggleDNC = async () => {
    if (!lead || dncSyncing) return;
    const newDNC = !lead.dnc;
    setDncSyncing(true);

    const newDisposition = newDNC ? 'DNC' : 'Customer Reached';
    const updated = await updateLead(lead.id, { dnc: newDNC, disposition: newDisposition });
    if (updated) setLead(updated);

    if (lead.ghl_contact_id) {
      try {
        await updateContactDNCInGHL(lead.ghl_contact_id, newDNC);
      } catch (err) {
        console.error('GHL DNC sync failed:', err);
      }
    }

    setDncSyncing(false);
  };

  if (editing && lead) {
    return <LeadFormPage editLead={lead} />;
  }

  if (loading) {
    return (
      <Layout title="Lead Details">
        <div className="flex items-center justify-center h-64">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      </Layout>
    );
  }

  if (!lead) {
    return (
      <Layout title="Lead Details">
        <div className="text-center py-16">
          <p className="font-body text-gray-500">Lead not found.</p>
          <button onClick={() => navigate('lead-list')} className="mt-4 font-body text-sm text-blue-600 hover:underline">
            Back to Lead List
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Lead Details" subtitle={lead.property_address}>
      <div className="max-w-4xl">
        <div className="flex items-start gap-3 flex-wrap mb-4">
          <button
            onClick={() => navigate('lead-list')}
            className="inline-flex items-center gap-2 font-body text-sm text-gray-500 hover:text-gray-800 transition-colors mt-0.5"
          >
            <ArrowLeft size={15} />
            Back to List
          </button>
          <span className="text-gray-300 mt-0.5">|</span>
          <DispositionBadge disposition={lead.disposition} />
          <DNCToggle
            phone={lead.phone}
            isDNC={lead.dnc}
            syncing={dncSyncing}
            onToggle={handleToggleDNC}
          />
          {lead.ghl_contact_id && (
            <span className="font-body text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              GHL Synced
            </span>
          )}
          <div className="ml-auto">
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-body font-medium text-sm transition-colors shadow-sm"
            >
              <Edit2 size={15} />
              Edit Lead
            </button>
          </div>
        </div>

        <StickyNav />

        <div className="space-y-5 mt-5">
          <OverviewSection lead={lead} />
          <PropertyInsightsSection lead={lead} />
          <LoansSection lead={lead} />
          <TransactionsSection lead={lead} />
          <PreForeclosuresSection />
          <ComparablesSection />
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-200 px-6 py-4 mt-5">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <span className="font-body text-xs text-gray-400">Lead ID: </span>
              <span className="font-body text-xs text-gray-600 font-mono">{lead.id}</span>
            </div>
            <div>
              <span className="font-body text-xs text-gray-400">Created: </span>
              <span className="font-body text-xs text-gray-600">{new Date(lead.created_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="font-body text-xs text-gray-400">Last Updated: </span>
              <span className="font-body text-xs text-gray-600">{new Date(lead.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
