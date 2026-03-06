import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Send, RefreshCw, ChevronDown, ChevronUp,
  Star, ToggleLeft, ToggleRight, Download, Plus, Trash2,
  Tag, CheckSquare, Square, X, AlertTriangle, BookmarkPlus,
  Bookmark, ChevronRight, Loader2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Toast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { SCORE_TIER_COLORS, SCORE_TIER_EMOJIS, STATUS_COLORS, computeDistressScore, determineOverallStatus, detectDNCLitigator } from '../lib/scoring';
import { pushContactToGHL, syncDNCToGHL, deleteOpportunityFromGHL } from '../lib/ghl';
import type { Contact, SavedFilter } from '../types';
import { ExportModal } from '../components/ExportModal';
import { ContactDetailModal } from '../components/ContactDetailModal';

const DEFAULT_PAGE_SIZE = 50;

const getContactDisplayName = (contact: Contact): string => {
  if (contact.lead_type === 'commercial') {
    return contact.property_name || 'Unknown Property';
  }
  return `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'Unknown Contact';
};

/** Returns the first callable (non-DNC) phone across contacts_json or flat fields */
const getFirstCallablePhone = (c: Contact): string => {
  if (c.contacts_json && c.contacts_json.length > 0) {
    for (const ce of c.contacts_json) {
      for (const p of ce.phones) {
        if (!p.dnc) return p.number;
      }
    }
    return c.contacts_json[0]?.phones[0]?.number || '';
  }
  return c.contact1_phone1 || '';
};

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

interface Filters {
  search: string;
  status: string;
  leadType: string;
  tier: string;
  state: string;
  city: string;
  county: string;
  pushed: string;
  source: string;
  priority: string;
  distressFlags: string[];
  tags: string[];
  dateFrom: string;
  dateTo: string;
  batchId: string;
  dnc: string;
}

const DEFAULT_FILTERS: Filters = {
  search: '', status: '', leadType: '', tier: '', state: '', city: '', county: '',
  pushed: '', source: '', priority: '', distressFlags: [], tags: [],
  dateFrom: '', dateTo: '', batchId: '', dnc: '',
};

function ManualAddModal({ onClose, onSaved, userId }: { onClose: () => void; onSaved: () => void; userId: string }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', property_address: '', property_city: '',
    property_state: '', property_zip: '', county: '', mailing_address: '',
    contact1_phone1: '', contact1_email1: '', property_type: '',
    beds: '', baths: '', year_built: '', sqft: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.first_name && !form.property_address) return;
    setSaving(true);
    const fakeRow: Record<string, string> = {};
    const { score, tier } = computeDistressScore(fakeRow);
    const { dnc, litigator } = detectDNCLitigator(fakeRow);
    const overall_status = determineOverallStatus(dnc, litigator, false);

    const { data: contact } = await supabase.from('contacts').insert({
      ...form,
      sqft: form.sqft ? parseFloat(form.sqft) : null,
      year_built: form.year_built ? parseInt(form.year_built) : null,
      beds: form.beds || null,
      baths: form.baths || null,
      distress_score: score,
      score_tier: tier,
      overall_status,
      dnc_toggle: false,
      source: 'Manual Entry',
      created_by: userId,
    }).select().single();

    if (contact) {
      await supabase.from('contact_activity_logs').insert({
        contact_id: (contact as Contact).id,
        action: 'Manually Added',
        action_detail: `${form.first_name} ${form.last_name} — ${form.property_address}`,
        action_by: userId,
      });
      if (tier === 'Hot') {
        await supabase.from('notifications').insert({
          type: 'Hot Lead',
          message: `New hot lead manually added: ${form.first_name} ${form.last_name}`,
          contact_id: (contact as Contact).id,
        });
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const f = (field: string, label: string, type = 'text', colSpan = 1) => (
    <div className={colSpan === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type={type}
        value={(form as Record<string, string>)[field] ?? ''}
        onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Add Contact Manually</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            {f('first_name', 'First Name')}
            {f('last_name', 'Last Name')}
            {f('property_address', 'Property Address', 'text', 2)}
            {f('property_city', 'City')}
            {f('property_state', 'State')}
            {f('property_zip', 'Zip')}
            {f('county', 'County')}
            {f('mailing_address', 'Mailing Address', 'text', 2)}
            {f('contact1_phone1', 'Phone')}
            {f('contact1_email1', 'Email')}
            {f('property_type', 'Property Type')}
            {f('year_built', 'Year Built', 'number')}
            {f('beds', 'Beds')}
            {f('baths', 'Baths')}
            {f('sqft', 'Sqft', 'number')}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm transition-colors" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || (!form.first_name && !form.property_address)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Save Contact
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveFilterModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Save Current Filter</h2>
        <input
          autoFocus
          type="text"
          placeholder="Filter name..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none mb-4"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkTagModal({ count, onClose, onApply }: { count: number; onClose: () => void; onApply: (tag: string) => void }) {
  const [tag, setTag] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Add Tag to {count} Contact{count !== 1 ? 's' : ''}</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Enter the tag to apply to all selected contacts.</p>
        <input autoFocus type="text" placeholder="Tag name..." value={tag} onChange={e => setTag(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tag.trim() && onApply(tag.trim())}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none mb-4"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={() => tag.trim() && onApply(tag.trim())} disabled={!tag.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            Apply Tag
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, onClose, onConfirm, danger = false }: {
  title: string; message: string; confirmLabel: string; onClose: () => void; onConfirm: () => void; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle size={20} className="text-amber-400 flex-shrink-0" />
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: danger ? '#ef4444' : 'var(--accent)', color: '#fff' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Removed exportToCSV inline function, now handled by ExportModal

export function ContactsPage() {
  const { navigate } = useRouter();
  const { profile, user, can } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'distress_score' | 'created_at' | 'first_name'>('distress_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [pushing, setPushing] = useState<string | null>(null);
  const [dncToggling, setDncToggling] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batches, setBatches] = useState<{ id: string; batch_name: string }[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [showBulkPushConfirm, setShowBulkPushConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkDNCConfirm, setShowBulkDNCConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState<Contact[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [distressOpen, setDistressOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const buildQuery = useCallback((q: ReturnType<typeof supabase.from>) => {
    let qb = q as ReturnType<typeof supabase.from<'contacts'>['select']>;
    if (filters.search) {
      qb = qb.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,property_name.ilike.%${filters.search}%,property_address.ilike.%${filters.search}%,contact1_phone1.ilike.%${filters.search}%,contact1_email1.ilike.%${filters.search}%`);
    }
    if (filters.status) qb = qb.eq('overall_status', filters.status);
    if (filters.leadType) qb = qb.eq('lead_type', filters.leadType);
    if (filters.tier) qb = qb.eq('score_tier', filters.tier);
    if (filters.state) qb = qb.eq('property_state', filters.state);
    if (filters.city) qb = qb.ilike('property_city', `%${filters.city}%`);
    if (filters.county) qb = qb.ilike('county', `%${filters.county}%`);
    if (filters.pushed === 'yes') qb = qb.eq('pushed_to_ghl', true);
    if (filters.pushed === 'no') qb = qb.eq('pushed_to_ghl', false);
    if (filters.source) qb = qb.eq('source', filters.source);
    if (filters.priority === 'yes') qb = qb.eq('priority_flag', true);
    if (filters.priority === 'no') qb = qb.eq('priority_flag', false);
    if (filters.dnc === 'yes') qb = qb.eq('dnc_toggle', true);
    if (filters.dnc === 'no') qb = qb.eq('dnc_toggle', false);
    if (filters.batchId) qb = qb.eq('batch_id', filters.batchId);
    if (filters.dateFrom) qb = qb.gte('created_at', filters.dateFrom);
    if (filters.dateTo) qb = qb.lte('created_at', filters.dateTo + 'T23:59:59');
    for (const flag of filters.distressFlags) {
      const key = DISTRESS_FLAG_KEYS[flag];
      if (key) qb = qb.eq(key as string, true);
    }
    if (filters.tags.length > 0) {
      qb = qb.overlaps('tags', filters.tags);
    }
    return qb;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('contacts').select('*', { count: 'exact' });
    q = buildQuery(q as unknown as ReturnType<typeof supabase.from>) as unknown as typeof q;
    q = q.order(sortBy, { ascending: sortDir === 'asc' }).range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, count } = await q;
    setContacts((data ?? []) as Contact[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [buildQuery, sortBy, sortDir, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('import_batches').select('id, batch_name').order('uploaded_at', { ascending: false })
      .then(({ data }) => setBatches((data ?? []) as { id: string; batch_name: string }[]));
    supabase.from('saved_filters').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setSavedFilters((data ?? []) as SavedFilter[]));
    supabase.from('contacts').select('tags').not('tags', 'is', null)
      .then(({ data }) => {
        const set = new Set<string>();
        (data ?? []).forEach((r: { tags?: string[] }) => r.tags?.forEach(t => set.add(t)));
        setAllTags(Array.from(set).sort());
      });
  }, []);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map(c => c.id)));
  };

  const handlePriorityToggle = async (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    const newVal = !contact.priority_flag;
    await supabase.from('contacts').update({ priority_flag: newVal }).eq('id', contact.id);
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, priority_flag: newVal } : c));
  };

  const handleDNCToggle = async (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    if (dncToggling === contact.id) return;
    setDncToggling(contact.id);
    const newDNC = !contact.dnc_toggle;
    const newStatus = newDNC ? 'DNC' : (contact.litigator ? 'Litigator' : 'Clean');
    await supabase.from('contacts').update({ dnc_toggle: newDNC, overall_status: newStatus }).eq('id', contact.id);
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, dnc_toggle: newDNC, overall_status: newStatus } : c));
    try {
      await syncDNCToGHL({ ...contact, dnc_toggle: newDNC, overall_status: newStatus }, newDNC);
      showToast(newDNC ? 'DNC enabled — GHL updated' : 'DNC removed — GHL updated');
    } catch {
      showToast(newDNC ? 'DNC enabled (GHL sync failed)' : 'DNC removed (GHL sync failed)', 'error');
    }
    setDncToggling(null);
  };

  const handlePush = async (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contact.id) return;
    setPushing(contact.id);
    try {
      const { contactId, opportunityId } = await pushContactToGHL(contact);
      await supabase.from('contacts').update({ pushed_to_ghl: true, ghl_contact_id: contactId, ghl_opportunity_id: opportunityId, ghl_stage: contact.dnc_toggle ? 'DNC – Email Only' : 'New Lead' }).eq('id', contact.id);
      await supabase.from('contact_activity_logs').insert({ contact_id: contact.id, action: 'Pushed to GHL', action_detail: `Contact ID: ${contactId}`, action_by: profile?.display_name ?? 'Unknown' });
      load();
      showToast('Contact pushed to GHL');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed';
      await supabase.from('notifications').insert({ type: 'Push Failed', message: `Failed to push ${getContactDisplayName(contact)}: ${msg}`, contact_id: contact.id });
      showToast('GHL push failed', 'error');
    }
    setPushing(null);
  };

  const handleBulkPush = async () => {
    setShowBulkPushConfirm(false);
    setBulkLoading(true);
    const toPush = contacts.filter(c => selected.has(c.id) && !c.pushed_to_ghl && c.overall_status !== 'Litigator');
    let pushed = 0;
    let failed = 0;
    for (let i = 0; i < toPush.length; i++) {
      const c = toPush[i];
      showToast(`Syncing ${i + 1} of ${toPush.length} to GHL...`);
      try {
        const { contactId, opportunityId } = await pushContactToGHL(c);
        await supabase.from('contacts').update({
          pushed_to_ghl: true,
          ghl_contact_id: contactId,
          ghl_opportunity_id: opportunityId,
          ghl_sync_status: 'Synced',
        }).eq('id', c.id);
        pushed++;
      } catch {
        await supabase.from('contacts').update({ ghl_sync_status: 'Failed' }).eq('id', c.id);
        failed++;
      }
    }
    setBulkLoading(false);
    setSelected(new Set());
    load();
    const msg = failed > 0
      ? `${pushed} synced, ${failed} failed`
      : `${pushed} contact${pushed !== 1 ? 's' : ''} pushed to GHL`;
    showToast(msg, failed > 0 ? 'error' : 'success');
  };

  const handleBulkTag = async (tag: string) => {
    setShowBulkTagModal(false);
    setBulkLoading(true);
    for (const id of selected) {
      const contact = contacts.find(c => c.id === id);
      if (!contact) continue;
      const newTags = [...new Set([...(contact.tags ?? []), tag])];
      await supabase.from('contacts').update({ tags: newTags }).eq('id', id);
    }
    setBulkLoading(false);
    setSelected(new Set());
    load();
    showToast(`Tag "${tag}" added to ${selected.size} contacts`);
  };

  const handleBulkDNC = async () => {
    setShowBulkDNCConfirm(false);
    setBulkLoading(true);
    for (const id of selected) {
      await supabase.from('contacts').update({ dnc_toggle: true, overall_status: 'DNC' }).eq('id', id);
    }
    setBulkLoading(false);
    setSelected(new Set());
    load();
    showToast(`${selected.size} contacts flagged as DNC`);
  };

  const handleBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    setBulkLoading(true);

    const selectedIds = Array.from(selected);
    const { data: contactsToDelete } = await supabase
      .from('contacts')
      .select('id, ghl_opportunity_id')
      .in('id', selectedIds);

    if (contactsToDelete) {
      for (const contact of contactsToDelete) {
        if (contact.ghl_opportunity_id) {
          try {
            await deleteOpportunityFromGHL(contact.ghl_opportunity_id);
          } catch (err) {
            console.error('Failed to delete opportunity from GHL:', err);
          }
        }
      }
    }

    await supabase.from('contacts').delete().in('id', selectedIds);
    setBulkLoading(false);
    setSelected(new Set());
    load();
    showToast(`${selected.size} contacts deleted`);
  };

  const handleExport = async () => {
    setShowExportModal(true);
    setExportLoading(true);
    try {
      let q = supabase.from('contacts').select('*').limit(10000);
      q = buildQuery(q as unknown as ReturnType<typeof supabase.from>) as unknown as typeof q;
      const { data } = await q;
      setExportData((data ?? []) as Contact[]);
    } catch (e) {
      showToast('Error fetching contacts for export', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const handleSaveFilter = async (name: string) => {
    setShowSaveModal(false);
    const { data } = await supabase.from('saved_filters').insert({
      filter_name: name,
      filter_config: filters as unknown as Record<string, unknown>,
      created_by: user?.id,
    }).select().single();
    if (data) setSavedFilters(prev => [data as SavedFilter, ...prev]);
    showToast(`Filter "${name}" saved`);
  };

  const handleDeleteSavedFilter = async (id: string) => {
    await supabase.from('saved_filters').delete().eq('id', id);
    setSavedFilters(prev => prev.filter(f => f.id !== id));
  };

  const applySavedFilter = (sf: SavedFilter) => {
    if (sf.filter_config) setFilters(sf.filter_config as unknown as Filters);
    setPage(0);
  };

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'search') return false;
    return Array.isArray(v) ? v.length > 0 : !!v;
  });

  const SortHeader = ({ col, label }: { col: typeof sortBy; label: string }) => (
    <button onClick={() => handleSort(col)} className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
      style={{ color: sortBy === col ? 'var(--accent-bright)' : 'var(--text-secondary)' }}>
      {label}
      {sortBy === col ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
    </button>
  );

  const eligibleToPush = contacts.filter(c => selected.has(c.id) && !c.pushed_to_ghl && c.overall_status !== 'Litigator');

  return (
    <Layout
      title="Contacts"
      subtitle={`${total.toLocaleString()} total`}
      action={
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <Download size={13} /> Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <Plus size={13} /> Add Contact
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Search + filter bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              placeholder="Search name, address, phone, email..."
              className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none transition-colors"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: showFilters || hasActiveFilters ? 'rgba(30,111,164,0.15)' : 'var(--bg-card)',
              border: `1px solid ${showFilters || hasActiveFilters ? 'var(--accent)' : 'var(--border)'}`,
              color: showFilters || hasActiveFilters ? 'var(--accent-bright)' : 'var(--text-secondary)',
            }}>
            <Filter size={14} />
            Filters {hasActiveFilters && <span className="bg-[#1E90FF] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">•</span>}
          </button>
          <button onClick={() => setShowSaveModal(true)} title="Save current filters"
            className="p-2.5 rounded-xl transition-colors" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <BookmarkPlus size={15} />
          </button>
        </div>

        {/* Saved filters chips */}
        {savedFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {savedFilters.map(sf => (
              <div key={sf.id} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <Bookmark size={11} />
                <button onClick={() => applySavedFilter(sf)} className="hover:opacity-70 transition-opacity">{sf.filter_name}</button>
                <button onClick={() => handleDeleteSavedFilter(sf.id)} className="ml-1 hover:text-red-400 transition-colors">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Expanded filters */}
        {showFilters && (
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex flex-wrap gap-3">
              {/* Status */}
              <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="">All Status</option>
                {['Clean', 'DNC', 'Litigator'].map(o => <option key={o}>{o}</option>)}
              </select>
              {/* Lead Type */}
              <select value={filters.leadType} onChange={e => setFilter('leadType', e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="">All Lead Types</option>
                <option value="commercial">Commercial</option>
                <option value="acquisition">Acquisitions</option>
              </select>
              {/* Score Tier */}
              <select value={filters.tier} onChange={e => setFilter('tier', e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="">All Tiers</option>
                {['Hot', 'Warm', 'Lukewarm', 'Cold', 'No Signal'].map(o => <option key={o}>{o}</option>)}
              </select>
              {/* State */}
              <input placeholder="State (e.g. TX)" value={filters.state} onChange={e => setFilter('state', e.target.value)}
                className="w-28 rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              {/* City */}
              <input placeholder="City" value={filters.city} onChange={e => setFilter('city', e.target.value)}
                className="w-32 rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              {/* County */}
              <input placeholder="County" value={filters.county} onChange={e => setFilter('county', e.target.value)}
                className="w-32 rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              {/* Source */}
              <select value={filters.source} onChange={e => setFilter('source', e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="">All Sources</option>
                <option value="CSV Import">CSV Import</option>
                <option value="Manual Entry">Manual Entry</option>
              </select>
              {/* Pushed to GHL */}
              <select value={filters.pushed} onChange={e => setFilter('pushed', e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="">All GHL</option>
                <option value="yes">Pushed to GHL</option>
                <option value="no">Not Pushed</option>
              </select>
              {/* DNC */}
              <select value={filters.dnc} onChange={e => setFilter('dnc', e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="">All DNC</option>
                <option value="yes">DNC Only</option>
                <option value="no">Not DNC</option>
              </select>
              {/* Priority */}
              <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="">All Priority</option>
                <option value="yes">Priority Only</option>
                <option value="no">Not Priority</option>
              </select>
              {/* Batch */}
              {batches.length > 0 && (
                <select value={filters.batchId} onChange={e => setFilter('batchId', e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="">All Batches</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
                </select>
              )}
            </div>

            <div className="flex flex-wrap gap-3 items-start">
              {/* Date range */}
              <div className="flex items-center gap-2">
                <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>From</label>
                <input type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>To</label>
                <input type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>

              {/* Distress Flags multi-select */}
              <div className="relative">
                <button onClick={() => setDistressOpen(p => !p)}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  Distress Flags {filters.distressFlags.length > 0 && <span className="text-xs bg-[#1E6FA4]/30 text-[#1E90FF] px-1.5 py-0.5 rounded-full">{filters.distressFlags.length}</span>}
                  <ChevronDown size={12} />
                </button>
                {distressOpen && (
                  <div className="absolute top-full mt-1 left-0 z-30 w-56 rounded-xl shadow-xl p-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    {DISTRESS_FLAG_OPTIONS.map(flag => (
                      <label key={flag} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:opacity-80">
                        <input type="checkbox" checked={filters.distressFlags.includes(flag)}
                          onChange={e => setFilter('distressFlags', e.target.checked ? [...filters.distressFlags, flag] : filters.distressFlags.filter(f => f !== flag))}
                          className="rounded" />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{flag}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags multi-select */}
              {allTags.length > 0 && (
                <div className="relative">
                  <button onClick={() => setTagsOpen(p => !p)}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    Tags {filters.tags.length > 0 && <span className="text-xs bg-[#1E6FA4]/30 text-[#1E90FF] px-1.5 py-0.5 rounded-full">{filters.tags.length}</span>}
                    <ChevronDown size={12} />
                  </button>
                  {tagsOpen && (
                    <div className="absolute top-full mt-1 left-0 z-30 w-48 rounded-xl shadow-xl p-2 max-h-48 overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      {allTags.map(tag => (
                        <label key={tag} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:opacity-80">
                          <input type="checkbox" checked={filters.tags.includes(tag)}
                            onChange={e => setFilter('tags', e.target.checked ? [...filters.tags, tag] : filters.tags.filter(t => t !== tag))} className="rounded" />
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{tag}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {hasActiveFilters && (
                <button onClick={() => { setFilters(DEFAULT_FILTERS); setPage(0); }} className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(30,111,164,0.15)', border: '1px solid rgba(30,111,164,0.4)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--accent-bright)' }}>{selected.size} selected</span>
            <button onClick={() => setSelected(new Set())} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>Deselect all</button>
            <div className="flex items-center gap-2 ml-auto">
              {eligibleToPush.length > 0 && (
                <button onClick={() => setShowBulkPushConfirm(true)} disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <Send size={12} /> Push to GHL ({eligibleToPush.length})
                </button>
              )}
              <button onClick={() => setShowBulkTagModal(true)} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <Tag size={12} /> Add Tag
              </button>
              <button onClick={() => setShowBulkDNCConfirm(true)} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                style={{ background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.4)', color: '#fb923c' }}>
                <AlertTriangle size={12} /> Flag DNC
              </button>
              <button onClick={handleExport} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <Download size={12} /> Export
              </button>
              {can('canDelete') && (
                <button onClick={() => setShowBulkDeleteConfirm(true)} disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                  <th className="px-3 py-3 w-8">
                    <button onClick={toggleSelectAll} style={{ color: 'var(--text-muted)' }}>
                      {selected.size === contacts.length && contacts.length > 0
                        ? <CheckSquare size={15} style={{ color: 'var(--accent-bright)' }} />
                        : <Square size={15} />}
                    </button>
                  </th>
                  <th className="px-2 py-3 w-8" />
                  <th className="text-left px-4 py-3"><SortHeader col="first_name" label="Owner" /></th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Address</th>
                  <th className="text-left px-4 py-3"><SortHeader col="distress_score" label="Score" /></th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Sellability</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>DNC</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Disposition</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Source</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>GHL</th>
                  <th className="text-left px-4 py-3"><SortHeader col="created_at" label="Created" /></th>
                  <th className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {Array.from({ length: 13 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-card)' }} /></td>
                      ))}
                    </tr>
                  ))
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No contacts found.
                    </td>
                  </tr>
                ) : contacts.map(c => (
                  <tr key={c.id}
                    onClick={() => setSelectedContact(c)}
                    className="cursor-pointer transition-colors"
                    title={`${getContactDisplayName(c)}${getFirstCallablePhone(c) ? ' · ' + getFirstCallablePhone(c) : ''}`}
                    style={{ borderBottom: '1px solid var(--border)', background: selected.has(c.id) ? 'rgba(30,111,164,0.08)' : undefined }}
                    onMouseEnter={e => { if (!selected.has(c.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = selected.has(c.id) ? 'rgba(30,111,164,0.08)' : ''; }}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 w-8" onClick={e => { e.stopPropagation(); toggleSelect(c.id); }}>
                      {selected.has(c.id)
                        ? <CheckSquare size={15} style={{ color: 'var(--accent-bright)' }} />
                        : <Square size={15} style={{ color: 'var(--text-muted)' }} />}
                    </td>
                    {/* Priority star */}
                    <td className="px-2 py-3 w-8" onClick={e => handlePriorityToggle(c, e)}>
                      <Star size={14} fill={c.priority_flag ? '#f59e0b' : 'none'}
                        style={{ color: c.priority_flag ? '#f59e0b' : 'var(--text-muted)' }} />
                    </td>
                    {/* Owner */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{getContactDisplayName(c)}</div>
                      {c.contact1_phone1 && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.contact1_phone1}</div>}
                    </td>
                    {/* Address */}
                    <td className="px-4 py-3 text-sm max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>
                      <div className="truncate">{c.property_address}</div>
                      {(c.property_city || c.property_state) && (
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{[c.property_city, c.property_state].filter(Boolean).join(', ')}</div>
                      )}
                    </td>
                    {/* Score */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.score_tier && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SCORE_TIER_COLORS[c.score_tier as keyof typeof SCORE_TIER_COLORS] ?? ''}`}>
                            {SCORE_TIER_EMOJIS[c.score_tier as keyof typeof SCORE_TIER_EMOJIS]} {c.score_tier}
                          </span>
                        )}
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.distress_score ?? 0}</span>
                      </div>
                    </td>
                    {/* Sellability Scores */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {c.retail_sellability_score && (
                          <div className="flex flex-col items-center px-1.5 py-1 rounded" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                            <div className="text-[10px] font-bold" style={{ color: '#22c55e' }}>{c.retail_sellability_score}°</div>
                            <div className="text-[9px]" style={{ color: 'rgba(34,197,94,0.7)' }}>Retail</div>
                          </div>
                        )}
                        {c.rental_sellability_score && (
                          <div className="flex flex-col items-center px-1.5 py-1 rounded" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }}>
                            <div className="text-[10px] font-bold" style={{ color: '#eab308' }}>{c.rental_sellability_score}°</div>
                            <div className="text-[9px]" style={{ color: 'rgba(234,179,8,0.7)' }}>Rental</div>
                          </div>
                        )}
                        {c.wholesale_sellability_score && (
                          <div className="flex flex-col items-center px-1.5 py-1 rounded" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
                            <div className="text-[10px] font-bold" style={{ color: '#a855f7' }}>{c.wholesale_sellability_score}°</div>
                            <div className="text-[9px]" style={{ color: 'rgba(168,85,247,0.7)' }}>Whsl</div>
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      {c.overall_status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.overall_status] ?? ''}`}>
                          {c.overall_status}
                        </span>
                      )}
                    </td>
                    {/* DNC toggle */}
                    <td className="px-4 py-3" onClick={e => handleDNCToggle(c, e)}>
                      {dncToggling === c.id
                        ? <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                        : c.dnc_toggle
                          ? <ToggleRight size={20} className="text-orange-400" />
                          : <ToggleLeft size={20} style={{ color: 'var(--text-muted)' }} />
                      }
                    </td>
                    {/* Disposition */}
                    <td className="px-4 py-3">
                      {c.last_disposition
                        ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{c.last_disposition}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>
                    {/* Source */}
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {c.source === 'Manual Entry' ? 'Manual' : 'CSV'}
                      </span>
                    </td>
                    {/* GHL */}
                    <td className="px-4 py-3">
                      {c.pushed_to_ghl
                        ? <span className="text-xs text-emerald-400">Pushed</span>
                        : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    {/* Created */}
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate('contact-detail', c.id)} title="View"
                          className="transition-colors hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                          <ChevronRight size={15} />
                        </button>
                        {!c.pushed_to_ghl && c.overall_status !== 'Litigator' && (
                          <button onClick={e => handlePush(c, e)} disabled={pushing === c.id} title="Push to GHL"
                            className="transition-colors hover:text-emerald-400 disabled:opacity-40" style={{ color: 'var(--text-muted)' }}>
                            {pushing === c.id ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="bg-[#0A1628] border border-white/10 rounded px-2 py-1 text-xs text-white/80"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="text-sm transition-colors disabled:opacity-25" style={{ color: 'var(--text-secondary)' }}>◀ Previous</button>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page + 1} of {Math.ceil(total / pageSize)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= total}
                  className="text-sm transition-colors disabled:opacity-25" style={{ color: 'var(--text-secondary)' }}>Next ▶</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && <ManualAddModal onClose={() => setShowAddModal(false)} onSaved={load} userId={user?.id ?? ''} />}
      {showSaveModal && <SaveFilterModal onClose={() => setShowSaveModal(false)} onSave={handleSaveFilter} />}
      {showBulkTagModal && <BulkTagModal count={selected.size} onClose={() => setShowBulkTagModal(false)} onApply={handleBulkTag} />}
      {showBulkPushConfirm && (
        <ConfirmModal
          title="Push to GHL"
          message={`Push ${eligibleToPush.length} eligible contact${eligibleToPush.length !== 1 ? 's' : ''} to GoHighLevel?`}
          confirmLabel="Push All"
          onClose={() => setShowBulkPushConfirm(false)}
          onConfirm={handleBulkPush}
        />
      )}
      {showBulkDNCConfirm && (
        <ConfirmModal
          title="Flag as DNC"
          message={`Flag ${selected.size} contact${selected.size !== 1 ? 's' : ''} as Do Not Call? This will also update GHL.`}
          confirmLabel="Flag DNC"
          onClose={() => setShowBulkDNCConfirm(false)}
          onConfirm={handleBulkDNC}
          danger
        />
      )}
      {showBulkDeleteConfirm && (
        <ConfirmModal
          title="Delete Contacts"
          message={`Permanently delete ${selected.size} contact${selected.size !== 1 ? 's' : ''}? This cannot be undone.`}
          confirmLabel="Delete"
          onClose={() => setShowBulkDeleteConfirm(false)}
          onConfirm={handleBulkDelete}
          danger
        />
      )}

      {showExportModal && (
        <ExportModal
          contacts={exportData}
          loading={exportLoading}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdated={updated => {
            setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}
