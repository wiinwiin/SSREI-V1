import React, { useState } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Contact } from '../types';

interface EditContactModalProps {
  contact: Contact;
  onClose: () => void;
  onSaved: (updated: Contact) => void;
}

type EditSection = 'overview' | 'property' | 'contacts' | 'financial' | 'distress' | 'mls';

const SECTIONS: { id: EditSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'property', label: 'Property Info' },
  { id: 'contacts', label: 'Contacts & Phones' },
  { id: 'financial', label: 'Financial' },
  { id: 'distress', label: 'Distress Flags' },
  { id: 'mls', label: 'MLS Data' },
];

export function EditContactModal({ contact, onClose, onSaved }: EditContactModalProps) {
  const [activeSection, setActiveSection] = useState<EditSection>('overview');
  const [form, setForm] = useState<Partial<Contact>>(contact);
  const [saving, setSaving] = useState(false);

  const updateField = (field: keyof Contact, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .update({
          ...form,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contact.id)
        .select()
        .single();

      if (error) throw error;
      if (data) onSaved(data as Contact);
      onClose();
    } catch (err) {
      console.error('Failed to save contact:', err);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const renderOverviewSection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>First Name</label>
          <input value={form.first_name || ''} onChange={e => updateField('first_name', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Last Name</label>
          <input value={form.last_name || ''} onChange={e => updateField('last_name', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Mailing Address</label>
        <input value={form.mailing_address || ''} onChange={e => updateField('mailing_address', e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>City</label>
          <input value={form.mailing_city || ''} onChange={e => updateField('mailing_city', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>State</label>
          <input value={form.mailing_state || ''} onChange={e => updateField('mailing_state', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>ZIP</label>
          <input value={form.mailing_zip || ''} onChange={e => updateField('mailing_zip', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Source</label>
        <input value={form.source || ''} onChange={e => updateField('source', e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
      </div>
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Lead Source Detail</label>
        <input value={form.lead_source_detail || ''} onChange={e => updateField('lead_source_detail', e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
      </div>
    </div>
  );

  const renderPropertySection = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Property Address</label>
        <input value={form.property_address || ''} onChange={e => updateField('property_address', e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>City</label>
          <input value={form.property_city || ''} onChange={e => updateField('property_city', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>State</label>
          <input value={form.property_state || ''} onChange={e => updateField('property_state', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>ZIP</label>
          <input value={form.property_zip || ''} onChange={e => updateField('property_zip', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Property Type</label>
          <input value={form.property_type || ''} onChange={e => updateField('property_type', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>County</label>
          <input value={form.county || ''} onChange={e => updateField('county', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Beds</label>
          <input value={form.beds || ''} onChange={e => updateField('beds', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Baths</label>
          <input value={form.baths || ''} onChange={e => updateField('baths', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Units</label>
          <input value={form.units || ''} onChange={e => updateField('units', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Stories</label>
          <input value={form.stories || ''} onChange={e => updateField('stories', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Sqft</label>
          <input type="number" value={form.sqft || ''} onChange={e => updateField('sqft', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Lot Size</label>
          <input type="number" value={form.lot_size || ''} onChange={e => updateField('lot_size', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Year Built</label>
          <input type="number" value={form.year_built || ''} onChange={e => updateField('year_built', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Condition</label>
          <input value={form.condition || ''} onChange={e => updateField('condition', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Exterior</label>
          <input value={form.exterior || ''} onChange={e => updateField('exterior', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Roof</label>
          <input value={form.roof || ''} onChange={e => updateField('roof', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Zoning</label>
          <input value={form.zoning || ''} onChange={e => updateField('zoning', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>House Style</label>
          <input value={form.house_style || ''} onChange={e => updateField('house_style', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
    </div>
  );

  const renderContactsSection = () => (
    <div className="space-y-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="p-4 rounded-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Contact {i}</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Name</label>
                <input value={form[`contact${i}_name` as keyof Contact] as string || ''} onChange={e => updateField(`contact${i}_name` as keyof Contact, e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Type</label>
                <input value={form[`contact${i}_type` as keyof Contact] as string || ''} onChange={e => updateField(`contact${i}_type` as keyof Contact, e.target.value)}
                  placeholder="e.g. Owner, Spouse, Agent" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Phone 1</label>
                <input value={form[`contact${i}_phone1` as keyof Contact] as string || ''} onChange={e => updateField(`contact${i}_phone1` as keyof Contact, e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Phone 1 Type</label>
                <input value={form[`contact${i}_phone1_type` as keyof Contact] as string || ''} onChange={e => updateField(`contact${i}_phone1_type` as keyof Contact, e.target.value)}
                  placeholder="Mobile, Home, Work" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Email 1</label>
                <input type="email" value={form[`contact${i}_email1` as keyof Contact] as string || ''} onChange={e => updateField(`contact${i}_email1` as keyof Contact, e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Email 2</label>
                <input type="email" value={form[`contact${i}_email2` as keyof Contact] as string || ''} onChange={e => updateField(`contact${i}_email2` as keyof Contact, e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Email 3</label>
                <input type="email" value={form[`contact${i}_email3` as keyof Contact] as string || ''} onChange={e => updateField(`contact${i}_email3` as keyof Contact, e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderFinancialSection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>AVM</label>
          <input type="number" value={form.avm || ''} onChange={e => updateField('avm', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Market Value</label>
          <input type="number" value={form.market_value || ''} onChange={e => updateField('market_value', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Asking Price</label>
          <input type="number" value={form.asking_price || ''} onChange={e => updateField('asking_price', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Wholesale Value</label>
          <input type="number" value={form.wholesale_value || ''} onChange={e => updateField('wholesale_value', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Estimated Mortgage Balance</label>
          <input type="number" value={form.estimated_mortgage_balance || ''} onChange={e => updateField('estimated_mortgage_balance', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Estimated Mortgage Payment</label>
          <input type="number" value={form.estimated_mortgage_payment || ''} onChange={e => updateField('estimated_mortgage_payment', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>LTV (%)</label>
          <input type="number" value={form.ltv || ''} onChange={e => updateField('ltv', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Loan Amount</label>
          <input type="number" value={form.loan_amount || ''} onChange={e => updateField('loan_amount', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Rental Estimate Low</label>
          <input type="number" value={form.rental_estimate_low || ''} onChange={e => updateField('rental_estimate_low', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Rental Estimate High</label>
          <input type="number" value={form.rental_estimate_high || ''} onChange={e => updateField('rental_estimate_high', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Tax Amount</label>
          <input type="number" value={form.tax_amount || ''} onChange={e => updateField('tax_amount', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Loan Type</label>
          <input value={form.loan_type || ''} onChange={e => updateField('loan_type', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
      </div>
    </div>
  );

  const renderDistressSection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[
          { key: 'absentee_owner', label: 'Absentee Owner' },
          { key: 'foreclosure_activity', label: 'Foreclosure Activity' },
          { key: 'delinquent_tax', label: 'Delinquent Tax' },
          { key: 'high_equity', label: 'High Equity' },
          { key: 'free_and_clear', label: 'Free and Clear' },
          { key: 'upside_down', label: 'Upside Down' },
          { key: 'long_term_owner', label: 'Long Term Owner' },
          { key: 'potentially_inherited', label: 'Potentially Inherited' },
          { key: 'active_listing', label: 'Active Listing' },
          { key: 'priority_flag', label: 'Priority Flag' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 p-3 rounded-lg cursor-pointer hover:bg-opacity-50"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <input type="checkbox" checked={!!form[key as keyof Contact]}
              onChange={e => updateField(key as keyof Contact, e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderMLSSection = () => (
    <div className="space-y-6">
      <div className="p-4 rounded-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Current Listing</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label>
              <input value={form.mls_curr_status || ''} onChange={e => updateField('mls_curr_status', e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>List Price</label>
              <input type="number" value={form.mls_curr_list_price || ''} onChange={e => updateField('mls_curr_list_price', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>List Date</label>
              <input type="date" value={form.mls_curr_list_date || ''} onChange={e => updateField('mls_curr_list_date', e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Days on Market</label>
              <input type="number" value={form.mls_curr_days_on_market || ''} onChange={e => updateField('mls_curr_days_on_market', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Agent Name</label>
            <input value={form.mls_curr_agent_name || ''} onChange={e => updateField('mls_curr_agent_name', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'overview': return renderOverviewSection();
      case 'property': return renderPropertySection();
      case 'contacts': return renderContactsSection();
      case 'financial': return renderFinancialSection();
      case 'distress': return renderDistressSection();
      case 'mls': return renderMLSSection();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Edit Contact</h2>
          <button onClick={onClose} className="p-1 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-48 border-r p-4 space-y-1" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            {SECTIONS.map(section => (
              <button key={section.id} onClick={() => setActiveSection(section.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: activeSection === section.id ? 'var(--accent)' : 'transparent',
                  color: activeSection === section.id ? '#fff' : 'var(--text-secondary)',
                }}>
                {section.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {renderSection()}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
