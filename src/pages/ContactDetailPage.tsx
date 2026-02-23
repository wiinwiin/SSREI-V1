import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Send, RefreshCw, Star, ToggleLeft, ToggleRight,
  Plus, X, ExternalLink, Phone, Mail, Home, DollarSign,
  FileText, Activity, MessageSquare, Loader2, Edit2, Save,
  AlertTriangle, Tag, CheckCircle, XCircle,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Toast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { SCORE_TIER_COLORS, STATUS_COLORS } from '../lib/scoring';
import { pushContactToGHL, syncDNCToGHL } from '../lib/ghl';
import type { Contact, ContactNote, ContactActivityLog, ContactDocument, Offer } from '../types';

type TabId = 'overview' | 'property' | 'contacts' | 'financial' | 'distress' | 'mls' | 'notes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'property', label: 'Property Info' },
  { id: 'contacts', label: 'Contacts & Phones' },
  { id: 'financial', label: 'Financial' },
  { id: 'distress', label: 'Distress Flags' },
  { id: 'mls', label: 'MLS Data' },
  { id: 'notes', label: 'Notes & Activity' },
];

const DISPOSITIONS = [
  'Voicemail Left', 'No Answer', 'Not Interested', 'Soft Interest',
  'Warm Seller', 'DNC Request', 'Wrong Number', 'Disconnected', 'Callback Scheduled',
];

const DISPOSITION_TO_GHL_STAGE: Record<string, string> = {
  'No Answer': 'Attempted Contact',
  'Voicemail Left': 'Attempted Contact',
  'Not Interested': 'Spoke – Not Interested',
  'Soft Interest': 'Spoke – Soft Interest',
  'Warm Seller': 'Spoke – Warm Seller',
  'DNC Request': 'DNC – Email Only',
};

function fmt(v?: number | null) {
  if (v == null) return '—';
  return '$' + v.toLocaleString();
}
function pct(v?: number | null) {
  if (v == null) return '—';
  return v.toFixed(1) + '%';
}
function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value == null || value === '' || value === false) return null;
  return (
    <div>
      <span className="block text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{String(value)}</span>
    </div>
  );
}
function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {title && (
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
          {icon}{title}
        </h3>
      )}
      {children}
    </div>
  );
}

function AddOfferModal({ contactId, onClose, onSaved, userId }: { contactId: string; onClose: () => void; onSaved: (o: Offer) => void; userId: string }) {
  const [form, setForm] = useState({ offer_amount: '', offer_date: new Date().toISOString().split('T')[0], offer_status: 'Pending', counter_offer_amount: '', negotiation_notes: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    const { data } = await supabase.from('offers').insert({
      contact_id: contactId,
      offer_amount: parseFloat(form.offer_amount) || null,
      offer_date: form.offer_date,
      offer_status: form.offer_status,
      counter_offer_amount: form.counter_offer_amount ? parseFloat(form.counter_offer_amount) : null,
      negotiation_notes: form.negotiation_notes || null,
      created_by: userId,
    }).select().single();
    setSaving(false);
    if (data) onSaved(data as Offer);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Add Offer / LOI</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Offer Amount ($)', field: 'offer_amount', type: 'number' },
            { label: 'Offer Date', field: 'offer_date', type: 'date' },
            { label: 'Counter Offer Amount ($)', field: 'counter_offer_amount', type: 'number' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
              <input type={type} value={(form as Record<string, string>)[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          ))}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label>
            <select value={form.offer_status} onChange={e => setForm(p => ({ ...p, offer_status: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {['Pending', 'Accepted', 'Rejected', 'Countered'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Negotiation Notes</label>
            <textarea value={form.negotiation_notes} onChange={e => setForm(p => ({ ...p, negotiation_notes: e.target.value }))}
              rows={3} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.offer_amount}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Offer
          </button>
        </div>
      </div>
    </div>
  );
}

function AddDocumentModal({ contactId, onClose, onSaved, userId }: { contactId: string; onClose: () => void; onSaved: (d: ContactDocument) => void; userId: string }) {
  const [form, setForm] = useState({ document_name: '', document_type: 'LOI', document_url: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    const { data } = await supabase.from('contact_documents').insert({
      contact_id: contactId, ...form, created_by: userId,
    }).select().single();
    setSaving(false);
    if (data) onSaved(data as ContactDocument);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Add Document</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Document Name</label>
            <input value={form.document_name} onChange={e => setForm(p => ({ ...p, document_name: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
            <select value={form.document_type} onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {['LOI', 'Purchase Agreement', 'Inspection Report', 'Contract', 'Other'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>URL</label>
            <input value={form.document_url} onChange={e => setForm(p => ({ ...p, document_url: e.target.value }))}
              placeholder="https://..." className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.document_name}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Document
          </button>
        </div>
      </div>
    </div>
  );
}

function LogCallModal({ contactId, onClose, onSaved, userName }: { contactId: string; onClose: () => void; onSaved: () => void; userName: string }) {
  const [form, setForm] = useState({ duration: '', outcome: '', disposition: 'No Answer', note: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    await supabase.from('contact_activity_logs').insert({
      contact_id: contactId,
      action: 'Call Logged',
      action_detail: `Duration: ${form.duration || 'N/A'} | Outcome: ${form.outcome || 'N/A'} | ${form.note}`,
      action_by: userName,
    });
    setSaving(false);
    onSaved();
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Log Call</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Duration (e.g. 3:45)</label>
            <input value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Outcome</label>
            <input value={form.outcome} onChange={e => setForm(p => ({ ...p, outcome: e.target.value }))}
              placeholder="e.g. Left message, Spoke with owner..." className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Disposition</label>
            <select value={form.disposition} onChange={e => setForm(p => ({ ...p, disposition: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {DISPOSITIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Note</label>
            <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              rows={3} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Log Call
          </button>
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  'Pushed to GHL': <Send size={13} className="text-emerald-400" />,
  'Re-Push to GHL': <Send size={13} className="text-emerald-400" />,
  'DNC Toggle': <AlertTriangle size={13} className="text-orange-400" />,
  'Manually Added': <Plus size={13} className="text-blue-400" />,
  'Note Added': <MessageSquare size={13} className="text-sky-400" />,
  'Call Logged': <Phone size={13} className="text-violet-400" />,
  'Disposition Logged': <FileText size={13} className="text-amber-400" />,
  'Offer Added': <DollarSign size={13} className="text-green-400" />,
  'Document Added': <FileText size={13} className="text-blue-400" />,
  'Skip Traced': <CheckCircle size={13} className="text-cyan-400" />,
};

export function ContactDetailPage() {
  const { route, navigate } = useRouter();
  const { profile, user } = useAuth();
  const contactId = route.contactId;
  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [activity, setActivity] = useState<ContactActivityLog[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [documents, setDocuments] = useState<ContactDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [newNote, setNewNote] = useState('');
  const [pushing, setPushing] = useState(false);
  const [dncSyncing, setDncSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [dispositionVal, setDispositionVal] = useState('Voicemail Left');
  const [dispositionNote, setDispositionNote] = useState('');
  const [loggingDisp, setLoggingDisp] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState(false);
  const [followUpVal, setFollowUpVal] = useState('');
  const [skipTracedLoading, setSkipTracedLoading] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });
  const userName = profile?.display_name ?? 'Unknown';

  useEffect(() => {
    if (!contactId) return;
    const load = async () => {
      const [{ data: c }, { data: n }, { data: a }, { data: o }, { data: d }] = await Promise.all([
        supabase.from('contacts').select('*').eq('id', contactId).single(),
        supabase.from('contact_notes').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }),
        supabase.from('contact_activity_logs').select('*').eq('contact_id', contactId).order('action_at', { ascending: false }),
        supabase.from('offers').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }),
        supabase.from('contact_documents').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }),
      ]);
      setContact(c as Contact);
      setNotes((n ?? []) as ContactNote[]);
      setActivity((a ?? []) as ContactActivityLog[]);
      setOffers((o ?? []) as Offer[]);
      setDocuments((d ?? []) as ContactDocument[]);
      setFollowUpVal((c as Contact)?.follow_up_date ?? '');
      setLoading(false);
    };
    load();
  }, [contactId]);

  const logActivity = async (action: string, detail: string) => {
    const { data } = await supabase.from('contact_activity_logs').insert({
      contact_id: contactId, action, action_detail: detail, action_by: userName,
    }).select().single();
    if (data) setActivity(prev => [data as ContactActivityLog, ...prev]);
  };

  const handleDNCToggle = async () => {
    if (!contact || dncSyncing) return;
    setDncSyncing(true);
    const newDNC = !contact.dnc_toggle;
    const newStatus = newDNC ? 'DNC' : (contact.litigator ? 'Litigator' : 'Clean');
    await supabase.from('contacts').update({ dnc_toggle: newDNC, overall_status: newStatus }).eq('id', contact.id);
    setContact(prev => prev ? { ...prev, dnc_toggle: newDNC, overall_status: newStatus } : prev);
    await logActivity('DNC Toggle', newDNC ? 'Marked DNC' : 'Removed DNC');
    try {
      await syncDNCToGHL({ ...contact, dnc_toggle: newDNC }, newDNC);
      showToast(newDNC ? 'DNC enabled — GHL updated' : 'DNC removed — GHL updated');
    } catch {
      showToast('DNC updated in DB (GHL sync failed)', 'error');
    }
    setDncSyncing(false);
  };

  const handlePriorityToggle = async () => {
    if (!contact) return;
    const newVal = !contact.priority_flag;
    await supabase.from('contacts').update({ priority_flag: newVal }).eq('id', contact.id);
    setContact(prev => prev ? { ...prev, priority_flag: newVal } : prev);
  };

  const handlePush = async () => {
    if (!contact) return;
    setPushing(true);
    try {
      const { contactId: ghlId, opportunityId } = await pushContactToGHL(contact);
      await supabase.from('contacts').update({ pushed_to_ghl: true, ghl_contact_id: ghlId, ghl_opportunity_id: opportunityId }).eq('id', contact.id);
      setContact(prev => prev ? { ...prev, pushed_to_ghl: true, ghl_contact_id: ghlId, ghl_opportunity_id: opportunityId } : prev);
      await logActivity('Pushed to GHL', `Contact ID: ${ghlId}`);
      showToast('Contact pushed to GHL');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed';
      showToast('Push failed: ' + msg, 'error');
    }
    setPushing(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !contactId) return;
    const { data } = await supabase.from('contact_notes').insert({
      contact_id: contactId, note_text: newNote.trim(), created_by: userName,
    }).select().single();
    if (data) setNotes(prev => [data as ContactNote, ...prev]);
    await logActivity('Note Added', newNote.trim().slice(0, 100));
    setNewNote('');
    showToast('Note added');
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !contact) return;
    setAddingTag(true);
    const newTags = [...new Set([...(contact.tags ?? []), newTag.trim()])];
    await supabase.from('contacts').update({ tags: newTags }).eq('id', contact.id);
    setContact(prev => prev ? { ...prev, tags: newTags } : prev);
    setNewTag('');
    setAddingTag(false);
  };

  const handleRemoveTag = async (tag: string) => {
    if (!contact) return;
    const newTags = (contact.tags ?? []).filter(t => t !== tag);
    await supabase.from('contacts').update({ tags: newTags }).eq('id', contact.id);
    setContact(prev => prev ? { ...prev, tags: newTags } : prev);
  };

  const handleLogDisposition = async () => {
    if (!contact || loggingDisp) return;
    setLoggingDisp(true);
    const ghlStage = DISPOSITION_TO_GHL_STAGE[dispositionVal];
    const updates: Partial<Contact> = { last_disposition: dispositionVal };
    if (ghlStage) updates.ghl_stage = ghlStage;
    if (dispositionVal === 'DNC Request') updates.dnc_toggle = true;
    await supabase.from('contacts').update(updates).eq('id', contact.id);
    setContact(prev => prev ? { ...prev, ...updates } : prev);
    await logActivity('Disposition Logged', `${dispositionVal}${dispositionNote ? ` — ${dispositionNote}` : ''}`);
    setDispositionNote('');
    setLoggingDisp(false);
    showToast('Disposition logged');
  };

  const handleSaveFollowUp = async () => {
    if (!contact) return;
    await supabase.from('contacts').update({ follow_up_date: followUpVal || null }).eq('id', contact.id);
    setContact(prev => prev ? { ...prev, follow_up_date: followUpVal } : prev);
    setEditingFollowUp(false);
    showToast('Follow-up date saved');
  };

  const handleSkipTraced = async () => {
    if (!contact) return;
    setSkipTracedLoading(true);
    const newVal = !contact.skip_traced;
    await supabase.from('contacts').update({ skip_traced: newVal, ghl_stage: newVal ? 'Skip Traced / Contact Info Verified' : contact.ghl_stage }).eq('id', contact.id);
    setContact(prev => prev ? { ...prev, skip_traced: newVal } : prev);
    if (newVal) await logActivity('Skip Traced', 'Contact info verified');
    setSkipTracedLoading(false);
    showToast(newVal ? 'Marked as skip traced' : 'Skip trace removed');
  };

  const handleDeleteDocument = async (docId: string) => {
    await supabase.from('contact_documents').delete().eq('id', docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const callCount = activity.filter(a => a.action === 'Call Logged').length;

  if (loading) {
    return (
      <Layout title="Contact Detail">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)' }} />
        </div>
      </Layout>
    );
  }

  if (!contact) {
    return (
      <Layout title="Contact Not Found">
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Contact not found.</p>
          <button onClick={() => navigate('contacts')} className="text-sm mt-4 hover:underline" style={{ color: 'var(--accent-bright)' }}>Back to Contacts</button>
        </div>
      </Layout>
    );
  }

  const fullName = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'Unknown Contact';

  return (
    <Layout
      title={fullName}
      subtitle={contact.property_address}
      action={
        <button onClick={() => navigate('contacts')} className="flex items-center gap-2 text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={15} /> Back
        </button>
      }
    >
      {/* Header card */}
      <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{fullName}</h1>
              <button onClick={handlePriorityToggle} title="Toggle priority">
                <Star size={18} fill={contact.priority_flag ? '#f59e0b' : 'none'}
                  style={{ color: contact.priority_flag ? '#f59e0b' : 'var(--text-muted)' }} />
              </button>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {[contact.property_address, contact.property_city, contact.property_state, contact.property_zip].filter(Boolean).join(', ')}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {contact.score_tier && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_TIER_COLORS[contact.score_tier as keyof typeof SCORE_TIER_COLORS] ?? ''}`}>
                  {contact.score_tier} · {contact.distress_score}
                </span>
              )}
              {contact.overall_status && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[contact.overall_status] ?? ''}`}>
                  {contact.overall_status}
                </span>
              )}
              {contact.pushed_to_ghl && (
                <span className="text-xs px-2.5 py-1 rounded-full border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#34d399' }}>
                  GHL Synced
                </span>
              )}
              {contact.skip_traced && (
                <span className="text-xs px-2.5 py-1 rounded-full border" style={{ background: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.3)', color: '#22d3ee' }}>
                  Skip Traced
                </span>
              )}
            </div>
            {/* Tags */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {(contact.tags ?? []).map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(30,111,164,0.15)', border: '1px solid rgba(30,111,164,0.3)', color: 'var(--accent-bright)' }}>
                  <Tag size={10} />{tag}
                  <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 hover:opacity-70"><X size={9} /></button>
                </span>
              ))}
              {addingTag ? (
                <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') { setAddingTag(false); setNewTag(''); } }}
                  onBlur={() => { if (newTag) handleAddTag(); else setAddingTag(false); }}
                  placeholder="Tag name..." className="w-24 text-xs px-2 py-0.5 rounded-full focus:outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              ) : (
                <button onClick={() => setAddingTag(true)} className="text-xs px-2 py-0.5 rounded-full transition-colors"
                  style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>+ Tag</button>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleDNCToggle} disabled={dncSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: contact.dnc_toggle ? 'rgba(234,88,12,0.15)' : 'var(--bg)',
                border: `1px solid ${contact.dnc_toggle ? 'rgba(234,88,12,0.4)' : 'var(--border)'}`,
                color: contact.dnc_toggle ? '#fb923c' : 'var(--text-secondary)',
              }}>
              {dncSyncing ? <Loader2 size={13} className="animate-spin" /> : <ToggleLeft size={13} />}
              {contact.dnc_toggle ? 'Remove DNC' : 'Mark DNC'}
            </button>
            <button onClick={handleSkipTraced} disabled={skipTracedLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
              style={{
                background: contact.skip_traced ? 'rgba(6,182,212,0.1)' : 'var(--bg)',
                border: `1px solid ${contact.skip_traced ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
                color: contact.skip_traced ? '#22d3ee' : 'var(--text-secondary)',
              }}>
              {skipTracedLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
              {contact.skip_traced ? 'Skip Traced ✓' : 'Skip Trace'}
            </button>
            {!contact.pushed_to_ghl && contact.overall_status !== 'Litigator' ? (
              <button onClick={handlePush} disabled={pushing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                {pushing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                {pushing ? 'Pushing...' : 'Push to GHL'}
              </button>
            ) : contact.pushed_to_ghl ? (
              <button onClick={handlePush} disabled={pushing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {pushing ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Re-Push
              </button>
            ) : null}
            {contact.deal_automator_url && (
              <a href={contact.deal_automator_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <ExternalLink size={13} /> Deal Automator
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex overflow-x-auto mb-4 scrollbar-hide" style={{ borderBottom: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5"
            style={{
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-bright)' : '2px solid transparent',
              marginBottom: '-1px',
            }}>
            {tab.label}
            {tab.id === 'notes' && callCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(30,111,164,0.2)', color: 'var(--accent-bright)' }}>{callCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-4">

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Owner & Property" icon={<Home size={14} style={{ color: 'var(--accent-bright)' }} />}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" value={contact.first_name} />
                <Field label="Last Name" value={contact.last_name} />
                <Field label="Mailing Address" value={contact.mailing_address} />
                <Field label="Mailing City" value={contact.mailing_city} />
                <Field label="Property Address" value={contact.property_address} />
                <Field label="City" value={contact.property_city} />
                <Field label="State" value={contact.property_state} />
                <Field label="Zip" value={contact.property_zip} />
                <Field label="County" value={contact.county} />
              </div>
            </Card>

            <Card title="GHL & Pipeline" icon={<Send size={14} style={{ color: 'var(--accent-bright)' }} />}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Pushed to GHL</span>
                  <span className={`text-xs font-medium ${contact.pushed_to_ghl ? 'text-emerald-400' : ''}`} style={!contact.pushed_to_ghl ? { color: 'var(--text-muted)' } : {}}>
                    {contact.pushed_to_ghl ? 'Yes' : 'No'}
                  </span>
                </div>
                {contact.ghl_stage && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>GHL Stage</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{contact.ghl_stage}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Automation Track</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {contact.litigator ? 'Blocked' : contact.dnc_toggle ? 'Email Only' : 'Full Outreach'}
                  </span>
                </div>
                {contact.ghl_contact_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>GHL Contact ID</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{contact.ghl_contact_id}</span>
                  </div>
                )}
                {contact.last_disposition && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Last Disposition</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                      {contact.last_disposition}
                    </span>
                  </div>
                )}
                <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Follow-up Date</span>
                    <button onClick={() => setEditingFollowUp(!editingFollowUp)} className="text-xs transition-colors" style={{ color: 'var(--accent-bright)' }}>
                      <Edit2 size={11} />
                    </button>
                  </div>
                  {editingFollowUp ? (
                    <div className="flex gap-2">
                      <input type="date" value={followUpVal} onChange={e => setFollowUpVal(e.target.value)}
                        className="flex-1 rounded-lg px-2 py-1 text-xs focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                      <button onClick={handleSaveFollowUp} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
                        <Save size={11} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: contact.follow_up_date ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {contact.follow_up_date ? new Date(contact.follow_up_date).toLocaleDateString() : 'Not set'}
                    </span>
                  )}
                </div>
              </div>
            </Card>

            <Card title="Status & Score">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Overall Status" value={contact.overall_status} />
                <Field label="Distress Score" value={contact.distress_score} />
                <Field label="Score Tier" value={contact.score_tier} />
                <Field label="DNC" value={contact.dnc_toggle ? 'Yes' : 'No'} />
                <Field label="Source" value={contact.source} />
                <Field label="Batch" value={contact.batch_name} />
              </div>
            </Card>

            <Card title="Skip Trace">
              <div className="flex items-center gap-4">
                <button onClick={handleSkipTraced} disabled={skipTracedLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    background: contact.skip_traced ? 'rgba(6,182,212,0.1)' : 'var(--bg)',
                    border: `1px solid ${contact.skip_traced ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
                    color: contact.skip_traced ? '#22d3ee' : 'var(--text-primary)',
                  }}>
                  {skipTracedLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {contact.skip_traced ? 'Skip Traced ✓' : 'Mark as Skip Traced'}
                </button>
                {contact.skip_traced && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Stage → "Skip Traced / Contact Info Verified"</span>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: PROPERTY INFO */}
        {activeTab === 'property' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Property Details" icon={<Home size={14} style={{ color: 'var(--accent-bright)' }} />}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Property Type" value={contact.property_type} />
                <Field label="Units" value={contact.units} />
                <Field label="Beds" value={contact.beds} />
                <Field label="Baths" value={contact.baths} />
                <Field label="Sqft" value={contact.sqft?.toLocaleString()} />
                <Field label="Lot Size (sqft)" value={contact.lot_size?.toLocaleString()} />
                <Field label="Year Built" value={contact.year_built} />
                <Field label="House Style" value={contact.house_style} />
                <Field label="Stories" value={contact.stories} />
                <Field label="Condition" value={contact.condition} />
                <Field label="Exterior" value={contact.exterior} />
                <Field label="Roof" value={contact.roof} />
                <Field label="Basement" value={contact.basement} />
                <Field label="Garage" value={contact.garage} />
                <Field label="Heating" value={contact.heating} />
                <Field label="Air Conditioning" value={contact.air_conditioning} />
                <Field label="Water" value={contact.water} />
                <Field label="Sewer" value={contact.sewer} />
                <Field label="Zoning" value={contact.zoning} />
                <Field label="Subdivision" value={contact.subdivision} />
              </div>
            </Card>
            <div className="space-y-4">
              <Card title="Amenities">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Pool', val: contact.pool },
                    { label: 'Patio', val: contact.patio },
                    { label: 'Porch', val: contact.porch },
                    { label: 'Fireplace', val: contact.fireplace },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center gap-2">
                      {val ? <CheckCircle size={14} className="text-emerald-400" /> : <XCircle size={14} style={{ color: 'var(--text-muted)' }} />}
                      <span className="text-sm" style={{ color: val ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Location">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Property Address" value={contact.property_address} />
                  <Field label="City" value={contact.property_city} />
                  <Field label="State" value={contact.property_state} />
                  <Field label="Zip" value={contact.property_zip} />
                  <Field label="County" value={contact.county} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 3: CONTACTS & PHONES */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => {
              const name = contact[`contact${i}_name` as keyof Contact] as string | undefined;
              const type = contact[`contact${i}_type` as keyof Contact] as string | undefined;
              const phones = [1, 2, 3].map(j => ({
                num: contact[`contact${i}_phone${j}` as keyof Contact] as string | undefined,
                type: contact[`contact${i}_phone${j}_type` as keyof Contact] as string | undefined,
              })).filter(p => p.num);
              const emails = [1, 2, 3].map(j => contact[`contact${i}_email${j}` as keyof Contact] as string | undefined).filter(Boolean);
              if (!name && phones.length === 0 && emails.length === 0) return null;
              return (
                <Card key={i} title={`Contact ${i}${name ? `: ${name}` : ''}`} icon={<Phone size={14} style={{ color: 'var(--accent-bright)' }} />}>
                  <div className="space-y-3">
                    {type && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Type: {type}</p>}
                    {phones.map((p, j) => (
                      <div key={j} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--bg)' }}>
                        <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.num}</span>
                        {p.type && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.type}</span>}
                      </div>
                    ))}
                    {emails.map((e, j) => e ? (
                      <div key={j} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--bg)' }}>
                        <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{e}</span>
                      </div>
                    ) : null)}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* TAB 4: FINANCIAL */}
        {activeTab === 'financial' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Valuation" icon={<DollarSign size={14} style={{ color: 'var(--accent-bright)' }} />}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="AVM" value={fmt(contact.avm)} />
                <Field label="Market Value" value={fmt(contact.market_value)} />
                <Field label="Wholesale Value" value={fmt(contact.wholesale_value)} />
                <Field label="LTV" value={pct(contact.ltv)} />
                <Field label="Rental Est. Low" value={fmt(contact.rental_estimate_low)} />
                <Field label="Rental Est. High" value={fmt(contact.rental_estimate_high)} />
              </div>
            </Card>
            <Card title="Mortgage & Loans">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Loan Type" value={contact.loan_type} />
                <Field label="Loan Amount" value={fmt(contact.loan_amount)} />
                <Field label="# of Loans" value={contact.number_of_loans} />
                <Field label="Total Loans" value={fmt(contact.total_loans)} />
                <Field label="Est. Mortgage Bal." value={fmt(contact.estimated_mortgage_balance)} />
                <Field label="Est. Mortgage Pmt" value={fmt(contact.estimated_mortgage_payment)} />
                <Field label="Interest Rate" value={contact.mortgage_interest_rate ? pct(contact.mortgage_interest_rate) : null} />
                <Field label="Lender Name" value={contact.lender_name} />
                <Field label="Recording Date" value={contact.recording_date} />
                <Field label="Maturity Date" value={contact.maturity_date} />
              </div>
            </Card>
            <Card title="Taxes & HOA">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tax Amount" value={fmt(contact.tax_amount)} />
                <Field label="HOA" value={contact.hoa ? 'Yes' : contact.hoa === false ? 'No' : null} />
                <Field label="HOA Name" value={contact.hoa_name} />
                <Field label="HOA Fee" value={fmt(contact.hoa_fee)} />
                <Field label="HOA Frequency" value={contact.hoa_fee_frequency} />
              </div>
            </Card>
          </div>
        )}

        {/* TAB 5: DISTRESS FLAGS */}
        {activeTab === 'distress' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Absentee Owner', val: contact.absentee_owner, points: 2 },
                { label: 'Foreclosure Activity', val: contact.foreclosure_activity, points: 3 },
                { label: 'Delinquent Tax', val: contact.delinquent_tax, points: 3 },
                { label: 'High Equity', val: contact.high_equity, points: 2 },
                { label: 'Free & Clear', val: contact.free_and_clear, points: 2 },
                { label: 'Upside Down', val: contact.upside_down, points: 3 },
                { label: 'Long Term Owner', val: contact.long_term_owner, points: 2 },
                { label: 'Potentially Inherited', val: contact.potentially_inherited, points: 2 },
                { label: 'Active Listing', val: contact.active_listing, points: 1 },
              ].map(({ label, val, points }) => (
                <div key={label} className="rounded-xl p-4 flex items-start gap-3 transition-colors"
                  style={{
                    background: val ? 'rgba(239,68,68,0.08)' : 'var(--bg-card)',
                    border: `1px solid ${val ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
                  }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${val ? 'bg-red-900/40' : ''}`}
                    style={!val ? { background: 'var(--bg)' } : {}}>
                    {val ? <CheckCircle size={16} className="text-red-400" /> : <XCircle size={16} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: val ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</div>
                    <div className="text-xs mt-0.5" style={{ color: val ? '#f87171' : 'var(--text-muted)' }}>
                      {val ? `+${points} pts` : 'Not flagged'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Card title="Score Breakdown">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{contact.distress_score ?? 0}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Total Score</div>
                </div>
                {contact.score_tier && (
                  <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${SCORE_TIER_COLORS[contact.score_tier as keyof typeof SCORE_TIER_COLORS] ?? ''}`}>
                    {contact.score_tier}
                  </span>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 6: MLS DATA */}
        {activeTab === 'mls' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Current Listing">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Listing ID" value={contact.mls_curr_listing_id} />
                <Field label="Status" value={contact.mls_curr_status} />
                <Field label="List Date" value={contact.mls_curr_list_date} />
                <Field label="Sold Date" value={contact.mls_curr_sold_date} />
                <Field label="Days on Market" value={contact.mls_curr_days_on_market} />
                <Field label="List Price" value={fmt(contact.mls_curr_list_price)} />
                <Field label="Sale Price" value={fmt(contact.mls_curr_sale_price)} />
                <Field label="Source" value={contact.mls_curr_source} />
                <Field label="Agent" value={contact.mls_curr_agent_name} />
                <Field label="Office" value={contact.mls_curr_office} />
              </div>
              {contact.mls_curr_description && (
                <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{contact.mls_curr_description}</p>
              )}
            </Card>
            <Card title="Previous Listing">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Listing ID" value={contact.mls_prev_listing_id} />
                <Field label="Status" value={contact.mls_prev_status} />
                <Field label="List Date" value={contact.mls_prev_list_date} />
                <Field label="Sold Date" value={contact.mls_prev_sold_date} />
                <Field label="Days on Market" value={contact.mls_prev_days_on_market} />
                <Field label="List Price" value={fmt(contact.mls_prev_list_price)} />
                <Field label="Sale Price" value={fmt(contact.mls_prev_sale_price)} />
                <Field label="Source" value={contact.mls_prev_source} />
                <Field label="Agent" value={contact.mls_prev_agent_name} />
                <Field label="Office" value={contact.mls_prev_office} />
              </div>
              {contact.mls_prev_description && (
                <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{contact.mls_prev_description}</p>
              )}
            </Card>
          </div>
        )}

        {/* TAB 7: NOTES & ACTIVITY */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            {/* Section A: Disposition Logger */}
            <Card title="Log Disposition" icon={<FileText size={14} style={{ color: 'var(--accent-bright)' }} />}>
              <div className="space-y-3">
                <select value={dispositionVal} onChange={e => setDispositionVal(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  {DISPOSITIONS.map(d => <option key={d}>{d}</option>)}
                </select>
                <textarea value={dispositionNote} onChange={e => setDispositionNote(e.target.value)}
                  placeholder="Quick note..." rows={2}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                <div className="flex justify-end">
                  <button onClick={handleLogDisposition} disabled={loggingDisp}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {loggingDisp ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    Log Disposition
                  </button>
                </div>
              </div>
            </Card>

            {/* Section B: Call Logger */}
            <Card title={`Call Logger ${callCount > 0 ? `(${callCount} calls)` : ''}`} icon={<Phone size={14} style={{ color: 'var(--accent-bright)' }} />}>
              <button onClick={() => setShowLogCall(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <Plus size={14} /> Log Call
              </button>
            </Card>

            {/* Section C: Notes */}
            <Card title="Notes" icon={<MessageSquare size={14} style={{ color: 'var(--accent-bright)' }} />}>
              <div className="space-y-3">
                <div>
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a note..." rows={3}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <div className="flex justify-end mt-2">
                    <button onClick={handleAddNote} disabled={!newNote.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      <MessageSquare size={14} /> Add Note
                    </button>
                  </div>
                </div>
                {notes.map(note => (
                  <div key={note.id} className="rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{note.note_text}</p>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{note.created_by} · {note.created_at ? new Date(note.created_at).toLocaleString() : ''}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Section D: Offer / LOI Tracker */}
            <Card title="Offers / LOI" icon={<DollarSign size={14} style={{ color: 'var(--accent-bright)' }} />}>
              <div className="space-y-3">
                <button onClick={() => setShowAddOffer(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <Plus size={14} /> Add Offer
                </button>
                {offers.map(o => (
                  <div key={o.id} className="rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(o.offer_amount)}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          o.offer_status === 'Accepted' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50' :
                          o.offer_status === 'Rejected' ? 'bg-red-900/40 text-red-300 border border-red-700/50' :
                          o.offer_status === 'Countered' ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50' :
                          'bg-zinc-800 text-zinc-300 border border-zinc-700/50'
                        }`}>{o.offer_status}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.offer_date}</span>
                      </div>
                    </div>
                    {o.counter_offer_amount && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Counter: {fmt(o.counter_offer_amount)}</p>}
                    {o.negotiation_notes && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{o.negotiation_notes}</p>}
                  </div>
                ))}
              </div>
            </Card>

            {/* Section E: Documents */}
            <Card title="Documents" icon={<FileText size={14} style={{ color: 'var(--accent-bright)' }} />}>
              <div className="space-y-3">
                <button onClick={() => setShowAddDoc(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <Plus size={14} /> Add Document
                </button>
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{doc.document_name}</span>
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>{doc.document_type}</span>
                      {doc.notes && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{doc.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.document_url && (
                        <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                          className="transition-colors" style={{ color: 'var(--accent-bright)' }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button onClick={() => handleDeleteDocument(doc.id)} className="transition-colors hover:text-red-400" style={{ color: 'var(--text-muted)' }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Section F: Activity Timeline */}
            <Card title="Activity Timeline" icon={<Activity size={14} style={{ color: 'var(--accent-bright)' }} />}>
              {activity.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No activity yet.</p>
              ) : (
                <div className="space-y-1">
                  {activity.map(log => (
                    <div key={log.id} className="flex items-start gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--bg)' }}>
                        {ACTIVITY_ICONS[log.action ?? ''] ?? <Activity size={13} style={{ color: 'var(--text-muted)' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{log.action}</span>
                        {log.action_detail && (
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}> — {log.action_detail}</span>
                        )}
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {log.action_by} · {log.action_at ? new Date(log.action_at).toLocaleString() : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {showAddOffer && contactId && (
        <AddOfferModal
          contactId={contactId}
          onClose={() => setShowAddOffer(false)}
          onSaved={o => { setOffers(prev => [o, ...prev]); logActivity('Offer Added', fmt(o.offer_amount)); showToast('Offer saved'); }}
          userId={user?.id ?? ''}
        />
      )}
      {showAddDoc && contactId && (
        <AddDocumentModal
          contactId={contactId}
          onClose={() => setShowAddDoc(false)}
          onSaved={d => { setDocuments(prev => [d, ...prev]); logActivity('Document Added', d.document_name ?? ''); showToast('Document saved'); }}
          userId={user?.id ?? ''}
        />
      )}
      {showLogCall && contactId && (
        <LogCallModal
          contactId={contactId}
          onClose={() => setShowLogCall(false)}
          onSaved={() => {
            supabase.from('contact_activity_logs').select('*').eq('contact_id', contactId).order('action_at', { ascending: false })
              .then(({ data }) => setActivity((data ?? []) as ContactActivityLog[]));
            showToast('Call logged');
          }}
          userName={userName}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}
