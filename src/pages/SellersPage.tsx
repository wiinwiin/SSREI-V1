import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, UserCheck, Phone, Mail, Edit2, Trash2, X, Check,
  Search, MapPin, DollarSign, Loader2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Toast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Seller {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  property_types?: string[];
  target_areas?: string[];
  min_budget?: number;
  max_budget?: number;
  notes?: string;
  status?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

const PROPERTY_TYPES = ['SFR', 'Multi-Family', 'Commercial', 'Land', 'Mobile Home', 'Condo', 'Townhome'];

type FormState = Omit<Seller, 'id' | 'created_at' | 'updated_at'>;

const emptyForm = (): FormState => ({
  name: '',
  email: '',
  phone: '',
  company: '',
  property_types: [],
  target_areas: [],
  min_budget: undefined,
  max_budget: undefined,
  notes: '',
  status: 'active',
  is_active: true,
  created_by: '',
});

interface ToastState { message: string; type: 'success' | 'error'; }

export function SellersPage() {
  const { profile, isAdmin } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [areaInput, setAreaInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [search, setSearch] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    const { data } = await supabase.from('sellers').select('*').order('created_at', { ascending: false });
    setSellers((data ?? []) as Seller[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (seller?: Seller) => {
    if (seller) {
      setForm({
        name: seller.name,
        email: seller.email ?? '',
        phone: seller.phone ?? '',
        company: seller.company ?? '',
        property_types: seller.property_types ?? [],
        target_areas: seller.target_areas ?? [],
        min_budget: seller.min_budget,
        max_budget: seller.max_budget,
        notes: seller.notes ?? '',
        status: seller.status ?? 'active',
        is_active: seller.is_active ?? true,
        created_by: seller.created_by ?? '',
      });
      setAreaInput((seller.target_areas ?? []).join(', '));
      setEditId(seller.id);
    } else {
      setForm({ ...emptyForm(), created_by: profile?.display_name ?? '' });
      setAreaInput('');
      setEditId(null);
    }
    setShowForm(true);
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
    const target_areas = areaInput.split(',').map(s => s.trim()).filter(Boolean);
    const payload = {
      ...form,
      target_areas,
      created_by: profile?.display_name ?? 'Unknown',
    };
    if (editId) {
      const { data, error } = await supabase.from('sellers').update(payload).eq('id', editId).select().single();
      if (!error && data) {
        setSellers(prev => prev.map(s => s.id === editId ? data as Seller : s));
        showToast('Seller updated');
      } else {
        showToast(error?.message ?? 'Save failed', 'error');
      }
    } else {
      const { data, error } = await supabase.from('sellers').insert(payload).select().single();
      if (!error && data) {
        setSellers(prev => [data as Seller, ...prev]);
        showToast('Seller added');
      } else {
        showToast(error?.message ?? 'Save failed', 'error');
      }
    }
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('sellers').delete().eq('id', id);
    setSellers(prev => prev.filter(s => s.id !== id));
    setConfirmDelete(null);
    showToast('Seller deleted');
  };

  const handleToggleActive = async (seller: Seller) => {
    const next = !seller.is_active;
    await supabase.from('sellers').update({ is_active: next, status: next ? 'active' : 'inactive' }).eq('id', seller.id);
    setSellers(prev => prev.map(s => s.id === seller.id ? { ...s, is_active: next, status: next ? 'active' : 'inactive' } : s));
  };

  const filteredSellers = sellers.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.company?.toLowerCase().includes(search.toLowerCase()) ||
    s.target_areas?.some(a => a.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Layout
      title="Sellers"
      subtitle="Property seller list and lead matching"
      action={
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 bg-[#1E6FA4] hover:bg-[#1a5f8f] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={14} />
          Add Seller
        </button>
      }
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {sellers.length > 3 && (
        <div className="relative mb-5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sellers by name, email, company..."
            className="w-full bg-[#0D1F38] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors"
          />
        </div>
      )}

      {showForm && (
        <SellerFormModal
          form={form}
          setForm={setForm}
          areaInput={areaInput}
          setAreaInput={setAreaInput}
          editId={editId}
          saving={saving}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
          togglePropType={togglePropType}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#0D1F38] border border-white/8 rounded-xl p-5 h-44 animate-pulse" />
          ))
        ) : filteredSellers.length === 0 ? (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-3">
            <UserCheck size={36} className="text-white/15" />
            <p className="text-white/35 text-sm">No sellers yet. Add your first seller to get started.</p>
            <button onClick={() => openForm()} className="mt-1 text-[#1E90FF] text-sm hover:underline">
              Add Seller
            </button>
          </div>
        ) : (
          filteredSellers.map(seller => (
            <SellerCard
              key={seller.id}
              seller={seller}
              isAdmin={isAdmin}
              confirmDelete={confirmDelete}
              onEdit={() => openForm(seller)}
              onDelete={() => handleDelete(seller.id)}
              onConfirmDelete={() => setConfirmDelete(seller.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              onToggleActive={() => handleToggleActive(seller)}
            />
          ))
        )}
      </div>
    </Layout>
  );
}

interface SellerCardProps {
  seller: Seller;
  isAdmin: boolean;
  confirmDelete: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onToggleActive: () => void;
}

function SellerCard({
  seller, isAdmin, confirmDelete,
  onEdit, onDelete, onConfirmDelete, onCancelDelete,
  onToggleActive,
}: SellerCardProps) {
  const isActive = seller.is_active ?? true;

  return (
    <div className="bg-[#0D1F38] border border-white/8 hover:border-white/15 rounded-xl p-5 flex flex-col gap-3 transition-all duration-150 group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(30,111,164,0.15)' }}>
            <UserCheck size={18} className="text-[#1E90FF]" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">{seller.name}</div>
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
            confirmDelete === seller.id ? (
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
        {seller.company && (
          <div className="flex items-center gap-2">
            <UserCheck size={11} className="flex-shrink-0 text-white/25" />
            <span className="truncate">{seller.company}</span>
          </div>
        )}
        {seller.email && (
          <div className="flex items-center gap-2">
            <Mail size={11} className="flex-shrink-0 text-white/25" />
            <span className="truncate">{seller.email}</span>
          </div>
        )}
        {seller.phone && (
          <div className="flex items-center gap-2">
            <Phone size={11} className="flex-shrink-0 text-white/25" />
            <span>{seller.phone}</span>
          </div>
        )}
        {seller.target_areas?.length ? (
          <div className="flex items-center gap-2">
            <MapPin size={11} className="flex-shrink-0 text-white/25" />
            <span className="truncate">{seller.target_areas.join(', ')}</span>
          </div>
        ) : null}
        {(seller.min_budget || seller.max_budget) && (
          <div className="flex items-center gap-2">
            <DollarSign size={11} className="flex-shrink-0 text-white/25" />
            <span>
              {seller.min_budget ? `$${(seller.min_budget / 1000).toFixed(0)}k` : 'Any'}
              {' – '}
              {seller.max_budget ? `$${(seller.max_budget / 1000).toFixed(0)}k` : 'Any'}
            </span>
          </div>
        )}
        {seller.property_types?.length ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {seller.property_types.map(t => (
              <span key={t} className="bg-white/5 text-white/40 px-1.5 py-0.5 rounded text-xs">{t}</span>
            ))}
          </div>
        ) : null}
      </div>

      {seller.notes && (
        <p className="text-white/30 text-xs line-clamp-2 border-t border-white/5 pt-2">{seller.notes}</p>
      )}
    </div>
  );
}

interface SellerFormModalProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  areaInput: string;
  setAreaInput: (v: string) => void;
  editId: string | null;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  togglePropType: (t: string) => void;
}

function SellerFormModal({
  form, setForm, areaInput, setAreaInput, editId, saving,
  onSave, onClose, togglePropType,
}: SellerFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1F38] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 sticky top-0 bg-[#0D1F38] z-10">
          <h3 className="text-white font-semibold">{editId ? 'Edit Seller' : 'Add Seller'}</h3>
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
                placeholder="Seller full name"
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
            <div className="md:col-span-2">
              <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wide">Company</label>
              <input
                type="text"
                value={form.company ?? ''}
                onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                placeholder="Company name"
                className="w-full bg-[#0A1628] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wide">Target Areas <span className="text-white/25 lowercase normal-case">(comma separated)</span></label>
            <input
              type="text"
              value={areaInput}
              onChange={e => setAreaInput(e.target.value)}
              placeholder="e.g. Houston, Dallas, Austin"
              className="w-full bg-[#0A1628] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Min Budget', key: 'min_budget', prefix: '$' },
              { label: 'Max Budget', key: 'max_budget', prefix: '$' },
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
              placeholder="Additional notes about this seller..."
              className="w-full bg-[#0A1628] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors resize-none"
            />
          </div>

          <div>
            <button
              onClick={() => setForm(p => ({ ...p, is_active: !p.is_active, status: !p.is_active ? 'active' : 'inactive' }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${form.is_active ? 'bg-emerald-800/20 text-emerald-400 border-emerald-700/30' : 'border-white/15 text-white/40 hover:text-white'}`}
            >
              <span className={`w-2 h-2 rounded-full ${form.is_active ? 'bg-emerald-400' : 'bg-white/20'}`} />
              {form.is_active ? 'Active Seller' : 'Inactive Seller'}
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
            {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Seller'}
          </button>
        </div>
      </div>
    </div>
  );
}
