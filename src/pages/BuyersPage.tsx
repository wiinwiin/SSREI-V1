import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, UserCheck, Phone, Mail, Edit2, Trash2, X, Check,
  Search, MapPin, Building2, DollarSign, ExternalLink, Send,
  ChevronRight, Loader2, Star,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Toast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { SCORE_TIER_COLORS } from '../lib/scoring';
import type { Buyer, Contact } from '../types';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

const PROPERTY_TYPES = ['SFR', 'Multi-Family', 'Commercial', 'Land', 'Mobile Home', 'Condo', 'Townhome'];

type FormState = Omit<Buyer, 'id' | 'created_at'>;

const emptyForm = (): FormState => ({
  name: '',
  email: '',
  phone: '',
  states: [],
  cities: [],
  min_units: undefined,
  max_units: undefined,
  min_price: undefined,
  max_price: undefined,
  property_types: [],
  notes: '',
  is_active: true,
  active: true,
  created_by: '',
});

interface MatchContact extends Contact {
  id: string;
}

interface ToastState { message: string; type: 'success' | 'error'; }

export function BuyersPage() {
  const { profile, isAdmin } = useAuth();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [cityInput, setCityInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [matchBuyer, setMatchBuyer] = useState<Buyer | null>(null);
  const [matches, setMatches] = useState<MatchContact[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [search, setSearch] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    const { data } = await supabase.from('buyers').select('*').order('created_at', { ascending: false });
    setBuyers((data ?? []) as Buyer[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (buyer?: Buyer) => {
    if (buyer) {
      setForm({
        name: buyer.name,
        email: buyer.email ?? '',
        phone: buyer.phone ?? '',
        states: buyer.states ?? [],
        cities: buyer.cities ?? [],
        min_units: buyer.min_units,
        max_units: buyer.max_units,
        min_price: buyer.min_price,
        max_price: buyer.max_price,
        property_types: buyer.property_types ?? [],
        notes: buyer.notes ?? '',
        is_active: buyer.is_active ?? buyer.active ?? true,
        active: buyer.is_active ?? buyer.active ?? true,
        created_by: buyer.created_by ?? '',
      });
      setCityInput((buyer.cities ?? []).join(', '));
      setEditId(buyer.id);
    } else {
      setForm({ ...emptyForm(), created_by: profile?.display_name ?? '' });
      setCityInput('');
      setEditId(null);
    }
    setShowForm(true);
  };

  const toggleState = (st: string) => {
    setForm(prev => ({
      ...prev,
      states: prev.states?.includes(st)
        ? (prev.states ?? []).filter(s => s !== st)
        : [...(prev.states ?? []), st],
    }));
  };

  const togglePropType = (t: string) => {
    setForm(prev => ({
      ...prev,
      property_types: prev.property_types?.includes(t)
        ? (prev.property_types ?? []).filter(x => x !== t)
        : [...(prev.property_types ?? []), t],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const cities = cityInput.split(',').map(s => s.trim()).filter(Boolean);
    const payload = {
      ...form,
      cities,
      active: form.is_active ?? true,
      is_active: form.is_active ?? true,
      created_by: profile?.display_name ?? 'Unknown',
    };
    if (editId) {
      const { data, error } = await supabase.from('buyers').update(payload).eq('id', editId).select().single();
      if (!error && data) {
        setBuyers(prev => prev.map(b => b.id === editId ? data as Buyer : b));
        showToast('Buyer updated');
      } else {
        showToast(error?.message ?? 'Save failed', 'error');
      }
    } else {
      const { data, error } = await supabase.from('buyers').insert(payload).select().single();
      if (!error && data) {
        setBuyers(prev => [data as Buyer, ...prev]);
        showToast('Buyer added');
      } else {
        showToast(error?.message ?? 'Save failed', 'error');
      }
    }
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('buyers').delete().eq('id', id);
    setBuyers(prev => prev.filter(b => b.id !== id));
    setConfirmDelete(null);
    showToast('Buyer deleted');
  };

  const handleToggleActive = async (buyer: Buyer) => {
    const next = !(buyer.is_active ?? buyer.active ?? true);
    await supabase.from('buyers').update({ is_active: next, active: next }).eq('id', buyer.id);
    setBuyers(prev => prev.map(b => b.id === buyer.id ? { ...b, is_active: next, active: next } : b));
  };

  const openMatches = async (buyer: Buyer) => {
    setMatchBuyer(buyer);
    setMatches([]);
    setMatchLoading(true);

    let query = supabase
      .from('contacts')
      .select('id, first_name, last_name, property_address, property_city, property_state, property_zip, units, avm, score_tier, distress_score, deal_automator_url, overall_status')
      .eq('overall_status', 'Clean')
      .eq('ghl_sync_status', 'Synced');

    if (buyer.states?.length) {
      query = query.in('property_state', buyer.states);
    }
    if (buyer.min_price) query = query.gte('avm', buyer.min_price);
    if (buyer.max_price) query = query.lte('avm', buyer.max_price);
    if (buyer.min_units) query = query.gte('units', String(buyer.min_units));
    if (buyer.max_units) query = query.lte('units', String(buyer.max_units));

    const { data } = await query.order('distress_score', { ascending: false }).limit(100);
    setMatches((data ?? []) as MatchContact[]);
    setMatchLoading(false);
  };

  const handleSendToBuyer = async (contact: MatchContact) => {
    if (!matchBuyer) return;
    setSendingId(contact.id);
    try {
      await supabase.from('contact_activity_logs').insert({
        contact_id: contact.id,
        action: 'Sent to Buyer',
        action_detail: `Sent to buyer: ${matchBuyer.name}`,
        action_by: profile?.display_name ?? 'Unknown',
      });
      await supabase.from('notifications').insert({
        type: 'General',
        message: `Contact "${contact.first_name} ${contact.last_name}" sent to buyer ${matchBuyer.name}`,
        contact_id: contact.id,
      });
      showToast(`Sent to ${matchBuyer.name}`);
    } catch {
      showToast('Failed to send', 'error');
    } finally {
      setSendingId(null);
    }
  };

  const filteredBuyers = buyers.filter(b =>
    !search ||
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.email?.toLowerCase().includes(search.toLowerCase()) ||
    b.states?.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Layout
      title="Buyers"
      subtitle="Cash buyer list and lead matching"
      action={
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 bg-[#1E6FA4] hover:bg-[#1a5f8f] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={14} />
          Add Buyer
        </button>
      }
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {buyers.length > 3 && (
        <div className="relative mb-5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search buyers by name, email, state..."
            className="w-full bg-[#0D1F38] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors"
          />
        </div>
      )}

      {showForm && (
        <BuyerFormModal
          form={form}
          setForm={setForm}
          cityInput={cityInput}
          setCityInput={setCityInput}
          editId={editId}
          saving={saving}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
          toggleState={toggleState}
          togglePropType={togglePropType}
        />
      )}

      {matchBuyer && (
        <MatchesModal
          buyer={matchBuyer}
          matches={matches}
          loading={matchLoading}
          sendingId={sendingId}
          onSend={handleSendToBuyer}
          onClose={() => setMatchBuyer(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#0D1F38] border border-white/8 rounded-xl p-5 h-44 animate-pulse" />
          ))
        ) : filteredBuyers.length === 0 ? (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-3">
            <UserCheck size={36} className="text-white/15" />
            <p className="text-white/35 text-sm">No buyers yet. Add your first buyer to get started.</p>
            <button onClick={() => openForm()} className="mt-1 text-[#1E90FF] text-sm hover:underline">
              Add Buyer
            </button>
          </div>
        ) : (
          filteredBuyers.map(buyer => (
            <BuyerCard
              key={buyer.id}
              buyer={buyer}
              isAdmin={isAdmin}
              confirmDelete={confirmDelete}
              onEdit={() => openForm(buyer)}
              onDelete={() => handleDelete(buyer.id)}
              onConfirmDelete={() => setConfirmDelete(buyer.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              onToggleActive={() => handleToggleActive(buyer)}
              onViewMatches={() => openMatches(buyer)}
            />
          ))
        )}
      </div>
    </Layout>
  );
}

interface BuyerCardProps {
  buyer: Buyer;
  isAdmin: boolean;
  confirmDelete: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onToggleActive: () => void;
  onViewMatches: () => void;
}

function BuyerCard({
  buyer, isAdmin, confirmDelete,
  onEdit, onDelete, onConfirmDelete, onCancelDelete,
  onToggleActive, onViewMatches,
}: BuyerCardProps) {
  const isActive = buyer.is_active ?? buyer.active ?? true;

  return (
    <div className="bg-[#0D1F38] border border-white/8 hover:border-white/15 rounded-xl p-5 flex flex-col gap-3 transition-all duration-150 group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(30,111,164,0.15)' }}>
            <UserCheck size={18} className="text-[#1E90FF]" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">{buyer.name}</div>
            <button
              onClick={onToggleActive}
              className={`text-xs font-medium mt-0.5 transition-colors ${isActive ? 'text-emerald-400 hover:text-emerald-300' : 'text-white/30 hover:text-white/50'}`}
            >
              {isActive ? 'Active' : 'Inactive'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors">
            <Edit2 size={13} />
          </button>
          {isAdmin && (
            confirmDelete === buyer.id ? (
              <div className="flex items-center gap-1 bg-red-900/20 border border-red-700/30 rounded-lg px-2 py-1">
                <button onClick={onDelete} className="text-red-400 text-xs font-medium">Delete</button>
                <span className="text-white/20 text-xs mx-0.5">·</span>
                <button onClick={onCancelDelete} className="text-white/40 text-xs">Cancel</button>
              </div>
            ) : (
              <button onClick={onConfirmDelete} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-900/10 transition-colors">
                <Trash2 size={13} />
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-white/50">
        {buyer.email && (
          <div className="flex items-center gap-2">
            <Mail size={11} className="flex-shrink-0 text-white/25" />
            <span className="truncate">{buyer.email}</span>
          </div>
        )}
        {buyer.phone && (
          <div className="flex items-center gap-2">
            <Phone size={11} className="flex-shrink-0 text-white/25" />
            <span>{buyer.phone}</span>
          </div>
        )}
        {buyer.states?.length ? (
          <div className="flex items-center gap-2">
            <MapPin size={11} className="flex-shrink-0 text-white/25" />
            <span className="truncate">{buyer.states.join(', ')}</span>
          </div>
        ) : null}
        {buyer.cities?.length ? (
          <div className="flex items-center gap-2">
            <Building2 size={11} className="flex-shrink-0 text-white/25" />
            <span className="truncate">{buyer.cities.join(', ')}</span>
          </div>
        ) : null}
        {(buyer.min_price || buyer.max_price) && (
          <div className="flex items-center gap-2">
            <DollarSign size={11} className="flex-shrink-0 text-white/25" />
            <span>
              {buyer.min_price ? `$${(buyer.min_price / 1000).toFixed(0)}k` : 'Any'}
              {' – '}
              {buyer.max_price ? `$${(buyer.max_price / 1000).toFixed(0)}k` : 'Any'}
            </span>
          </div>
        )}
        {(buyer.min_units || buyer.max_units) && (
          <div className="flex items-center gap-2">
            <Building2 size={11} className="flex-shrink-0 text-white/25" />
            <span>Units: {buyer.min_units ?? 'Any'} – {buyer.max_units ?? 'Any'}</span>
          </div>
        )}
        {buyer.property_types?.length ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {buyer.property_types.map(t => (
              <span key={t} className="bg-white/5 text-white/40 px-1.5 py-0.5 rounded text-xs">{t}</span>
            ))}
          </div>
        ) : null}
      </div>

      {buyer.notes && (
        <p className="text-white/30 text-xs line-clamp-2 border-t border-white/5 pt-2">{buyer.notes}</p>
      )}

      <button
        onClick={onViewMatches}
        className="mt-auto flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all"
        style={{ background: 'rgba(30,111,164,0.08)', color: '#1E90FF', border: '1px solid rgba(30,111,164,0.15)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(30,111,164,0.18)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(30,111,164,0.08)'; }}
      >
        <span>View Matching Leads</span>
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

interface BuyerFormModalProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  cityInput: string;
  setCityInput: (v: string) => void;
  editId: string | null;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  toggleState: (s: string) => void;
  togglePropType: (t: string) => void;
}

function BuyerFormModal({
  form, setForm, cityInput, setCityInput, editId, saving,
  onSave, onClose, toggleState, togglePropType,
}: BuyerFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1F38] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 sticky top-0 bg-[#0D1F38] z-10">
          <h3 className="text-white font-semibold">{editId ? 'Edit Buyer' : 'Add Buyer'}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wide">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Buyer full name"
                className="w-full bg-[#0A1628] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors"
              />
            </div>
            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={form.email ?? ''}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full bg-[#0A1628] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors"
              />
            </div>
            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wide">Phone</label>
              <input
                type="text"
                value={form.phone ?? ''}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full bg-[#0A1628] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-white/50 text-xs font-medium mb-2 uppercase tracking-wide">Target States</label>
            <div className="flex flex-wrap gap-1.5">
              {US_STATES.map(st => (
                <button
                  key={st}
                  onClick={() => toggleState(st)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${form.states?.includes(st) ? 'bg-[#1E6FA4] text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wide">Target Cities <span className="text-white/25 lowercase normal-case">(comma separated)</span></label>
            <input
              type="text"
              value={cityInput}
              onChange={e => setCityInput(e.target.value)}
              placeholder="e.g. Houston, Dallas, Austin"
              className="w-full bg-[#0A1628] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Min Price', key: 'min_price', prefix: '$' },
              { label: 'Max Price', key: 'max_price', prefix: '$' },
              { label: 'Min Units', key: 'min_units', prefix: '' },
              { label: 'Max Units', key: 'max_units', prefix: '' },
            ].map(({ label, key, prefix }) => (
              <div key={key}>
                <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wide">{label}</label>
                <div className="relative">
                  {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">{prefix}</span>}
                  <input
                    type="number"
                    value={(form as Record<string, number | undefined>)[key] ?? ''}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value ? Number(e.target.value) : undefined }))}
                    className={`w-full bg-[#0A1628] border border-white/15 rounded-xl py-2.5 text-white text-sm focus:outline-none focus:border-[#1E6FA4] transition-colors ${prefix ? 'pl-7 pr-3' : 'px-3'}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-white/50 text-xs font-medium mb-2 uppercase tracking-wide">Property Types</label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => togglePropType(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${form.property_types?.includes(t) ? 'bg-[#1E6FA4]/25 text-[#1E90FF] border-[#1E6FA4]/40' : 'border-white/10 text-white/40 hover:text-white hover:border-white/20'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3}
              placeholder="Additional notes about this buyer's criteria..."
              className="w-full bg-[#0A1628] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors resize-none"
            />
          </div>

          <div>
            <button
              onClick={() => setForm(p => ({ ...p, is_active: !p.is_active, active: !p.is_active }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${form.is_active ? 'bg-emerald-800/20 text-emerald-400 border-emerald-700/30' : 'border-white/15 text-white/40 hover:text-white'}`}
            >
              <span className={`w-2 h-2 rounded-full ${form.is_active ? 'bg-emerald-400' : 'bg-white/20'}`} />
              {form.is_active ? 'Active Buyer' : 'Inactive Buyer'}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/8">
          <button onClick={onClose} className="text-white/50 hover:text-white text-sm transition-colors px-4 py-2">Cancel</button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-2 bg-[#1E6FA4] hover:bg-[#1a5f8f] text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Buyer'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MatchesModalProps {
  buyer: Buyer;
  matches: MatchContact[];
  loading: boolean;
  sendingId: string | null;
  onSend: (c: MatchContact) => void;
  onClose: () => void;
}

function MatchesModal({ buyer, matches, loading, sendingId, onSend, onClose }: MatchesModalProps) {
  const [search, setSearch] = useState('');

  const filtered = matches.filter(c =>
    !search ||
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    c.property_address?.toLowerCase().includes(search.toLowerCase()) ||
    c.property_city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1F38] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h3 className="text-white font-semibold">Matching Leads</h3>
            <p className="text-white/40 text-xs mt-0.5">
              {loading ? 'Searching...' : `${matches.length} match${matches.length !== 1 ? 'es' : ''} for ${buyer.name}`}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {!loading && matches.length > 5 && (
          <div className="px-6 pt-4 pb-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search matches..."
                className="w-full bg-[#0A1628] border border-white/15 rounded-lg pl-8 pr-3 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4]"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3">
              <Loader2 size={22} className="animate-spin text-[#1E6FA4]" />
              <span className="text-white/40 text-sm">Finding matches...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Search size={28} className="text-white/15" />
              <p className="text-white/40 text-sm text-center">
                {matches.length === 0
                  ? "No matching contacts found for this buyer's criteria."
                  : 'No matches for your search.'}
              </p>
              {matches.length === 0 && (
                <p className="text-white/25 text-xs text-center max-w-xs">
                  Try expanding the buyer's price range, unit range, or adding more states.
                </p>
              )}
            </div>
          ) : (
            filtered.map(contact => (
              <MatchRow
                key={contact.id}
                contact={contact}
                isSending={sendingId === contact.id}
                onSend={() => onSend(contact)}
              />
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between">
          <span className="text-white/30 text-xs">{filtered.length} of {matches.length} shown</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-sm transition-colors px-4 py-2">Close</button>
        </div>
      </div>
    </div>
  );
}

interface MatchRowProps {
  contact: MatchContact;
  isSending: boolean;
  onSend: () => void;
}

function MatchRow({ contact, isSending, onSend }: MatchRowProps) {
  return (
    <div className="bg-[#0A1628] border border-white/8 rounded-xl p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white text-sm font-medium truncate">
            {contact.first_name} {contact.last_name}
          </span>
          {contact.score_tier && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${SCORE_TIER_COLORS[contact.score_tier as keyof typeof SCORE_TIER_COLORS] ?? ''}`}>
              {contact.score_tier}
            </span>
          )}
        </div>
        <p className="text-white/45 text-xs truncate">
          {[contact.property_address, contact.property_city, contact.property_state, contact.property_zip].filter(Boolean).join(', ')}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
          {contact.units && <span>Units: {contact.units}</span>}
          {contact.avm ? <span>AVM: ${(contact.avm / 1000).toFixed(0)}k</span> : null}
          {typeof contact.distress_score === 'number' && contact.distress_score > 0 && (
            <span className="flex items-center gap-0.5">
              <Star size={9} className="text-yellow-400 fill-yellow-400" />
              {contact.distress_score}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {contact.deal_automator_url && (
          <a
            href={contact.deal_automator_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-white/30 hover:text-[#1E90FF] hover:bg-[#1E6FA4]/10 transition-colors"
            title="Open in Deal Automator"
          >
            <ExternalLink size={14} />
          </a>
        )}
        <button
          onClick={onSend}
          disabled={isSending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-emerald-800/20 text-emerald-400 border border-emerald-700/30 hover:bg-emerald-700/30 disabled:opacity-50"
        >
          {isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {isSending ? 'Sending...' : 'Send to Buyer'}
        </button>
      </div>
    </div>
  );
}
