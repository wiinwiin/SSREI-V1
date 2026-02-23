import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  RefreshCw, ExternalLink, Star, Users, Filter, X, Loader2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Toast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { useRouter } from '../context/RouterContext';
import { getPipelineStages, updateOpportunityStage, type GHLPipelineStage } from '../lib/ghl';
import { SCORE_TIER_COLORS, STATUS_COLORS } from '../lib/scoring';
import type { Contact } from '../types';

interface PipelineContact extends Contact {
  id: string;
  ghl_stage: string;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

const DISTRESS_FLAG_OPTIONS = [
  'Absentee Owner', 'Foreclosure', 'Delinquent Tax', 'High Equity',
  'Free & Clear', 'Upside Down', 'Long Term Owner', 'Potentially Inherited', 'Active Listing',
];

const DISTRESS_FLAG_KEYS: Record<string, keyof Contact> = {
  'Absentee Owner': 'absentee_owner',
  'Foreclosure': 'foreclosure_activity',
  'Delinquent Tax': 'delinquent_tax',
  'High Equity': 'high_equity',
  'Free & Clear': 'free_and_clear',
  'Upside Down': 'upside_down',
  'Long Term Owner': 'long_term_owner',
  'Potentially Inherited': 'potentially_inherited',
  'Active Listing': 'active_listing',
};

const COLUMN_ACCENT: { border: string; header: string; dot: string }[] = [
  { border: 'border-[#1E90FF]/25', header: 'text-[#1E90FF]', dot: 'bg-[#1E90FF]' },
  { border: 'border-emerald-500/25', header: 'text-emerald-400', dot: 'bg-emerald-500' },
  { border: 'border-yellow-500/25', header: 'text-yellow-400', dot: 'bg-yellow-500' },
  { border: 'border-orange-500/25', header: 'text-orange-400', dot: 'bg-orange-500' },
  { border: 'border-rose-500/25', header: 'text-rose-400', dot: 'bg-rose-500' },
  { border: 'border-zinc-500/25', header: 'text-zinc-400', dot: 'bg-zinc-500' },
];

export function PipelinePage() {
  const { navigate } = useRouter();
  const [stages, setStages] = useState<GHLPipelineStage[]>([]);
  const [contacts, setContacts] = useState<PipelineContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingStages, setRefreshingStages] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterTier, setFilterTier] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterPriority, setFilterPriority] = useState(false);
  const [filterDistressFlag, setFilterDistressFlag] = useState('');
  const dragContactRef = useRef<PipelineContact | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStagesFromCache = useCallback(async (): Promise<GHLPipelineStage[]> => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ghl_pipeline_stages')
      .maybeSingle();
    if (data?.value) {
      try {
        return JSON.parse(data.value) as GHLPipelineStage[];
      } catch { /* fall through */ }
    }
    return [];
  }, []);

  const fetchAndCacheStages = useCallback(async (): Promise<GHLPipelineStage[]> => {
    const { stages: fresh } = await getPipelineStages();
    await supabase.from('app_settings').upsert(
      { key: 'ghl_pipeline_stages', value: JSON.stringify(fresh) },
      { onConflict: 'key' }
    );
    return fresh;
  }, []);

  const loadContacts = useCallback(async () => {
    const { data } = await supabase
      .from('contacts')
      .select(`
        id, first_name, last_name,
        property_address, property_city, property_state,
        distress_score, score_tier, ghl_stage, overall_status,
        pushed_to_ghl, ghl_opportunity_id, ghl_contact_id,
        deal_automator_url, priority_flag, last_disposition,
        dnc_toggle, litigator, address_hash,
        absentee_owner, foreclosure_activity, delinquent_tax,
        high_equity, free_and_clear, upside_down,
        long_term_owner, potentially_inherited, active_listing
      `)
      .eq('ghl_sync_status', 'Synced')
      .not('ghl_stage', 'is', null);
    setContacts((data ?? []) as PipelineContact[]);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      let loaded: GHLPipelineStage[] = await loadStagesFromCache();
      if (!loaded.length) {
        try {
          loaded = await fetchAndCacheStages();
        } catch {
          showToast('Could not load pipeline stages from GHL. Using defaults.', 'error');
          loaded = [
            { id: 'new-lead', name: 'New Lead', position: 0 },
            { id: 'contacted', name: 'Contacted', position: 1 },
            { id: 'offer-made', name: 'Offer Made', position: 2 },
            { id: 'under-contract', name: 'Under Contract', position: 3 },
            { id: 'closed', name: 'Closed', position: 4 },
            { id: 'dead-deal', name: 'Dead Deal', position: 5 },
          ];
        }
      }
      setStages(loaded);
      await loadContacts();
      setLoading(false);
    };
    init();
  }, [loadStagesFromCache, fetchAndCacheStages, loadContacts]);

  const handleRefreshStages = async () => {
    setRefreshingStages(true);
    try {
      const fresh = await fetchAndCacheStages();
      setStages(fresh);
      showToast('Pipeline stages refreshed from GHL');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to refresh stages', 'error');
    } finally {
      setRefreshingStages(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, contact: PipelineContact) => {
    setDraggingId(contact.id);
    dragContactRef.current = contact;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStage(null);
    dragContactRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent, stageName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageName);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(related)) {
      setDragOverStage(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: GHLPipelineStage) => {
    e.preventDefault();
    setDragOverStage(null);
    const contact = dragContactRef.current;
    if (!contact || contact.ghl_stage === targetStage.name) return;

    const prevStage = contact.ghl_stage;
    setUpdatingId(contact.id);

    setContacts(prev => prev.map(c =>
      c.id === contact.id ? { ...c, ghl_stage: targetStage.name } : c
    ));

    try {
      await supabase.from('contacts').update({ ghl_stage: targetStage.name }).eq('id', contact.id);

      if (contact.ghl_opportunity_id) {
        await updateOpportunityStage(contact.ghl_opportunity_id, targetStage.id);
      }

      await supabase.from('contact_activity_logs').insert({
        contact_id: contact.id,
        address_hash: contact.address_hash,
        action: 'Stage Changed',
        action_detail: `${prevStage} → ${targetStage.name}`,
        action_by: 'Pipeline',
      });

      showToast(`Moved to "${targetStage.name}"`);
    } catch (err) {
      setContacts(prev => prev.map(c =>
        c.id === contact.id ? { ...c, ghl_stage: prevStage } : c
      ));
      showToast(err instanceof Error ? err.message : 'Failed to update stage', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredContacts = contacts.filter(c => {
    if (filterTier && c.score_tier !== filterTier) return false;
    if (filterState && c.property_state !== filterState) return false;
    if (filterCity && !c.property_city?.toLowerCase().includes(filterCity.toLowerCase())) return false;
    if (filterPriority && !c.priority_flag) return false;
    if (filterDistressFlag) {
      const key = DISTRESS_FLAG_KEYS[filterDistressFlag];
      if (key && !c[key]) return false;
    }
    return true;
  });

  const contactsByStage = (stageName: string) =>
    filteredContacts.filter(c =>
      (c.ghl_stage ?? '').toLowerCase().trim() === stageName.toLowerCase().trim()
    );

  const hasActiveFilters = filterTier || filterState || filterCity || filterPriority || filterDistressFlag;
  const allStates = [...new Set(contacts.map(c => c.property_state).filter(Boolean))].sort();

  if (loading) {
    return (
      <Layout title="Pipeline" subtitle="GHL synced contacts by stage">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 size={28} className="animate-spin text-[#1E6FA4]" />
          <p className="text-white/40 text-sm">Loading pipeline...</p>
        </div>
      </Layout>
    );
  }

  if (contacts.length === 0) {
    return (
      <Layout title="Pipeline" subtitle="GHL synced contacts by stage">
        <div className="flex flex-col items-center justify-center h-80 gap-4">
          <Users size={40} className="text-white/15" />
          <div className="text-center">
            <p className="text-white/60 font-medium mb-1">No contacts synced to GHL yet</p>
            <p className="text-white/30 text-sm">Import contacts and sync them to GHL to see them here.</p>
          </div>
          <button
            onClick={() => navigate('contacts')}
            className="mt-2 bg-[#1E6FA4] hover:bg-[#1a5f8f] text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
          >
            Go to Contacts
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Pipeline"
      subtitle={`${filteredContacts.length} contact${filteredContacts.length !== 1 ? 's' : ''} · ${stages.length} stages`}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${showFilters || hasActiveFilters ? 'bg-[#1E6FA4]/20 text-[#1E90FF] border-[#1E6FA4]/40' : 'border-white/15 text-white/60 hover:text-white'}`}
          >
            <Filter size={14} />
            Filters
            {hasActiveFilters && (
              <span className="bg-[#1E90FF] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {[filterTier, filterState, filterCity, filterPriority ? 'p' : '', filterDistressFlag].filter(Boolean).length}
              </span>
            )}
          </button>
          <button
            onClick={handleRefreshStages}
            disabled={refreshingStages}
            className="flex items-center gap-2 border border-white/15 text-white/60 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshingStages ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      }
    >
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showFilters && (
        <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-4 mb-5">
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterTier}
              onChange={e => setFilterTier(e.target.value)}
              className="bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#1E6FA4]"
            >
              <option value="">All Score Tiers</option>
              {['Hot', 'Warm', 'Lukewarm', 'Cold', 'No Signal'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterState}
              onChange={e => setFilterState(e.target.value)}
              className="bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#1E6FA4]"
            >
              <option value="">All States</option>
              {allStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="text"
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              placeholder="Filter by city..."
              className="bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#1E6FA4] placeholder-white/25 w-40"
            />
            <select
              value={filterDistressFlag}
              onChange={e => setFilterDistressFlag(e.target.value)}
              className="bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#1E6FA4]"
            >
              <option value="">All Distress Flags</option>
              {DISTRESS_FLAG_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <button
              onClick={() => setFilterPriority(!filterPriority)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${filterPriority ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/40' : 'border-white/15 text-white/50 hover:text-white'}`}
            >
              <Star size={13} className={filterPriority ? 'fill-yellow-400' : ''} />
              Priority Only
            </button>
            {hasActiveFilters && (
              <button
                onClick={() => { setFilterTier(''); setFilterState(''); setFilterCity(''); setFilterPriority(false); setFilterDistressFlag(''); }}
                className="flex items-center gap-1 text-white/40 hover:text-white text-sm transition-colors ml-auto"
              >
                <X size={13} />
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4" style={{ minWidth: `${stages.length * 300}px` }}>
          {stages.map((stage, idx) => {
            const stageContacts = contactsByStage(stage.name);
            const accent = COLUMN_ACCENT[idx % COLUMN_ACCENT.length];
            const isOver = dragOverStage === stage.name;

            return (
              <div
                key={stage.id}
                className="flex-shrink-0"
                style={{ width: 288 }}
                onDragOver={e => handleDragOver(e, stage.name)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, stage)}
              >
                <div className="flex items-center justify-between mb-3 px-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                    <h3 className={`text-xs font-semibold uppercase tracking-wider ${accent.header}`}>
                      {stage.name}
                    </h3>
                  </div>
                  <span className="text-white/30 text-xs bg-white/8 rounded-full px-2 py-0.5 font-mono">
                    {stageContacts.length}
                  </span>
                </div>

                <div
                  className={`rounded-xl border p-2.5 space-y-2 transition-all duration-150 ${accent.border} ${isOver ? 'bg-[#1E6FA4]/10 border-dashed border-[#1E6FA4]/50' : 'bg-[#080F1A]/50'}`}
                  style={{ minHeight: 160 }}
                >
                  {stageContacts.length === 0 && (
                    <div className={`flex items-center justify-center rounded-lg border border-dashed transition-colors ${isOver ? 'border-[#1E6FA4]/40 bg-[#1E6FA4]/5' : 'border-white/8'}`} style={{ minHeight: 80 }}>
                      <p className="text-white/15 text-xs">
                        {isOver ? `Drop to move here` : 'Empty'}
                      </p>
                    </div>
                  )}
                  {stageContacts.map(contact => (
                    <KanbanCard
                      key={contact.id}
                      contact={contact}
                      isDragging={draggingId === contact.id}
                      isUpdating={updatingId === contact.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate('contact-detail', contact.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

interface KanbanCardProps {
  contact: PipelineContact;
  isDragging: boolean;
  isUpdating: boolean;
  onDragStart: (e: React.DragEvent, c: PipelineContact) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function KanbanCard({ contact, isDragging, isUpdating, onDragStart, onDragEnd, onClick }: KanbanCardProps) {
  const statusKey = contact.litigator ? 'Litigator' : contact.dnc_toggle ? 'DNC' : (contact.overall_status ?? 'Clean');

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, contact)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`w-full text-left bg-[#0D1F38] border rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all duration-150 select-none ${isDragging ? 'opacity-25 scale-95 rotate-1' : 'hover:border-[#1E6FA4]/40 hover:-translate-y-0.5 hover:shadow-lg'} ${isUpdating ? 'opacity-60 pointer-events-none' : 'border-white/8'}`}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {contact.priority_flag && (
            <Star size={11} className="text-yellow-400 flex-shrink-0 fill-yellow-400" />
          )}
          <span className="text-white text-xs font-semibold truncate leading-tight">
            {contact.first_name} {contact.last_name}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isUpdating && <Loader2 size={11} className="animate-spin text-[#1E90FF]" />}
          {contact.deal_automator_url && (
            <a
              href={contact.deal_automator_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-white/20 hover:text-[#1E90FF] transition-colors"
              title="Open Deal Automator"
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      <p className="text-white/40 text-xs truncate mb-2 leading-tight">
        {[contact.property_address, contact.property_city, contact.property_state].filter(Boolean).join(', ')}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        {contact.score_tier && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${SCORE_TIER_COLORS[contact.score_tier as keyof typeof SCORE_TIER_COLORS] ?? ''}`}>
            {contact.score_tier}
          </span>
        )}
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[statusKey as keyof typeof STATUS_COLORS] ?? 'text-white/40 bg-white/5'}`}>
          {statusKey}
        </span>
        {contact.last_disposition && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/5 text-white/35 font-medium truncate max-w-24">
            {contact.last_disposition}
          </span>
        )}
      </div>

      {typeof contact.distress_score === 'number' && contact.distress_score > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, contact.distress_score)}%`,
                background: contact.distress_score >= 70 ? '#ef4444' : contact.distress_score >= 40 ? '#f59e0b' : '#3b82f6',
              }}
            />
          </div>
          <span className="text-white/25 text-xs font-mono w-6 text-right">{contact.distress_score}</span>
        </div>
      )}
    </div>
  );
}
