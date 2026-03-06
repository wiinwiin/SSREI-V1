import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { FormSection } from '../components/FormSection';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { useLeads } from '../hooks/useLeads';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { submitLeadToGHL } from '../lib/ghl';
import { Lead, LeadFormData, Disposition } from '../types';
import { Save, Loader2 } from 'lucide-react';
import { ShimmerButton } from '../components/ui/ShimmerButton';

const defaultForm = (): LeadFormData => ({
  owner_name: '',
  phone: '',
  email: '',
  dnc: false,
  owner_type: 'Individual',
  lead_type: 'acquisition',
  length_of_ownership: '',
  estimated_equity: '',
  absentee_owner: false,
  out_of_state_owner: false,
  mailing_address: '',
  property_address: '',
  city: '',
  state: '',
  zip: '',
  home_type: 'Single Family',
  square_feet: '',
  beds: '',
  baths: '',
  units: '',
  stories: '',
  county: '',
  zoning: '',
  parcel_number: '',
  lot_size: '',
  hoa: false,
  property_taxes: '',
  last_sale_date: '',
  last_sale_price: '',
  mortgage_amount: '',
  mortgage_balance: '',
  ltv: '',
  avm: '',
  rental_value: '',
  assessed_value: '',
  retail_value_estimate: '',
  rental_value_estimate: '',
  wholesale_value_estimate: '',
  retail_sellability_score: '',
  rental_sellability_score: '',
  wholesale_sellability_score: '',
  disposition: 'Customer Reached',
  notes: '',
  follow_up_date: null,
  submitted_by: '',
  ghl_contact_id: '',
  ghl_opportunity_id: '',
});

interface LeadFormPageProps {
  editLead?: Lead;
}

export function LeadFormPage({ editLead }: LeadFormPageProps) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { createLead, updateLead } = useLeads();
  const [form, setForm] = useState<LeadFormData>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (editLead) {
      setForm({
        owner_name: editLead.owner_name,
        phone: editLead.phone,
        email: editLead.email,
        dnc: editLead.dnc,
        owner_type: editLead.owner_type,
        lead_type: editLead.lead_type || 'acquisition',
        length_of_ownership: editLead.length_of_ownership,
        estimated_equity: editLead.estimated_equity,
        absentee_owner: editLead.absentee_owner,
        out_of_state_owner: editLead.out_of_state_owner,
        mailing_address: editLead.mailing_address,
        property_address: editLead.property_address,
        city: editLead.city,
        state: editLead.state,
        zip: editLead.zip,
        home_type: editLead.home_type,
        square_feet: editLead.square_feet,
        beds: editLead.beds,
        baths: editLead.baths,
        units: editLead.units,
        stories: editLead.stories,
        county: editLead.county,
        zoning: editLead.zoning,
        parcel_number: editLead.parcel_number,
        lot_size: editLead.lot_size,
        hoa: editLead.hoa,
        property_taxes: editLead.property_taxes,
        last_sale_date: editLead.last_sale_date,
        last_sale_price: editLead.last_sale_price,
        mortgage_amount: editLead.mortgage_amount,
        mortgage_balance: editLead.mortgage_balance,
        ltv: editLead.ltv,
        avm: editLead.avm,
        rental_value: editLead.rental_value,
        assessed_value: editLead.assessed_value,
        retail_value_estimate: editLead.retail_value_estimate,
        rental_value_estimate: editLead.rental_value_estimate,
        wholesale_value_estimate: editLead.wholesale_value_estimate,
        retail_sellability_score: editLead.retail_sellability_score,
        rental_sellability_score: editLead.rental_sellability_score,
        wholesale_sellability_score: editLead.wholesale_sellability_score,
        disposition: editLead.disposition,
        notes: editLead.notes,
        follow_up_date: editLead.follow_up_date,
        submitted_by: editLead.submitted_by,
        ghl_contact_id: editLead.ghl_contact_id,
        ghl_opportunity_id: editLead.ghl_opportunity_id,
      });
    } else {
      setForm(prev => ({ ...prev, submitted_by: user?.displayName || '' }));
    }
  }, [editLead, user]);

  const set = <K extends keyof LeadFormData>(key: K, value: LeadFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.owner_name.trim() || !form.property_address.trim()) {
      setToast({ message: 'Owner Name and Property Address are required.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      let savedLead: Lead | null = null;
      if (editLead) {
        savedLead = await updateLead(editLead.id, form);
      } else {
        savedLead = await createLead(form);
      }

      if (!savedLead) {
        setToast({ message: 'Failed to save lead. Please try again.', type: 'error' });
        setSaving(false);
        return;
      }

      if (!editLead) {
        try {
          const { contactId, opportunityId } = await submitLeadToGHL(savedLead);
          const updates: Partial<{ ghl_contact_id: string; ghl_opportunity_id: string }> = {};
          if (contactId) updates.ghl_contact_id = contactId;
          if (opportunityId) updates.ghl_opportunity_id = opportunityId;
          if (Object.keys(updates).length > 0) {
            await updateLead(savedLead.id, updates);
          }
          setToast({ message: 'Lead submitted and synced to GoHighLevel successfully!', type: 'success' });
        } catch (ghlErr) {
          console.error('GHL submission error:', ghlErr);
          setToast({ message: 'Lead saved, but GoHighLevel sync failed. Please check your connection.', type: 'error' });
          setTimeout(() => navigate('lead-list'), 2000);
          return;
        }
      } else {
        setToast({ message: 'Lead updated successfully!', type: 'success' });
      }

      setTimeout(() => navigate('lead-list'), 1500);
    } catch {
      setToast({ message: 'An error occurred. Please try again.', type: 'error' });
    }
    setSaving(false);
  };

  const dispositionOptions = [
    'Customer Reached', 'No Answer', 'Left Voicemail', 'Callback Requested', 'Not Interested', 'Wrong Number', 'Follow Up', 'Bad Email', 'DNC'
  ].map(d => ({ value: d, label: d }));

  return (
    <Layout
      title={editLead ? 'Edit Lead' : 'New Lead'}
      subtitle={editLead ? `Editing: ${editLead.property_address}` : 'Enter lead details below'}
    >
      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">

        <FormSection title="Owner Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <FormField
              type="select"
              label="Lead Type"
              value={form.lead_type}
              onChange={v => set('lead_type', v as LeadFormData['lead_type'])}
              options={[
                { value: 'acquisition', label: 'Acquisition (Residential)' },
                { value: 'commercial', label: 'Commercial' },
              ]}
              className="sm:col-span-3"
            />
            <FormField
              type="text"
              label="Owner Name"
              value={form.owner_name}
              onChange={v => set('owner_name', v)}
              placeholder="Full name"
              required
              className="sm:col-span-2"
            />
            <FormField
              type="text"
              label="Phone"
              value={form.phone}
              onChange={v => set('phone', v)}
              placeholder="(555) 000-0000"
            />
            <FormField
              type="text"
              label="Email"
              value={form.email}
              onChange={v => set('email', v)}
              placeholder="owner@example.com"
              className="sm:col-span-2"
            />
            <FormField
              type="select"
              label="Owner Type"
              value={form.owner_type}
              onChange={v => set('owner_type', v as LeadFormData['owner_type'])}
              options={[
                { value: 'Individual', label: 'Individual' },
                { value: 'LLC', label: 'LLC' },
                { value: 'Corporation', label: 'Corporation' },
                { value: 'Trust', label: 'Trust' },
              ]}
            />
            <FormField
              type="text"
              label="Length of Ownership"
              value={form.length_of_ownership}
              onChange={v => set('length_of_ownership', v)}
              placeholder="e.g. 5 years"
            />
            <FormField
              type="text"
              label="Estimated Equity"
              value={form.estimated_equity}
              onChange={v => set('estimated_equity', v)}
              placeholder="e.g. $120,000"
            />
            <div className="grid grid-cols-3 gap-4">
              <FormField
                type="toggle"
                label="Absentee Owner"
                value={form.absentee_owner}
                onChange={v => set('absentee_owner', v)}
              />
              <FormField
                type="toggle"
                label="Out of State Owner"
                value={form.out_of_state_owner}
                onChange={v => set('out_of_state_owner', v)}
              />
              <FormField
                type="toggle"
                label="Do Not Call (DNC)"
                value={form.dnc}
                onChange={v => set('dnc', v)}
              />
            </div>
            <FormField
              type="text"
              label="Mailing Address"
              value={form.mailing_address}
              onChange={v => set('mailing_address', v)}
              placeholder="Full mailing address"
              className="sm:col-span-2 lg:col-span-3"
            />
          </div>
        </FormSection>

        <FormSection title="Property Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <FormField
              type="text"
              label="Property Address"
              value={form.property_address}
              onChange={v => set('property_address', v)}
              placeholder="Street address"
              required
              className="sm:col-span-2 lg:col-span-3"
            />
            <FormField type="text" label="City" value={form.city} onChange={v => set('city', v)} placeholder="City" />
            <FormField type="text" label="State" value={form.state} onChange={v => set('state', v)} placeholder="TX" />
            <FormField type="text" label="Zip" value={form.zip} onChange={v => set('zip', v)} placeholder="12345" />
            <FormField
              type="select"
              label="Home Type"
              value={form.home_type}
              onChange={v => set('home_type', v as LeadFormData['home_type'])}
              options={[
                { value: 'Single Family', label: 'Single Family' },
                { value: 'Multifamily', label: 'Multifamily' },
                { value: 'Duplex', label: 'Duplex' },
                { value: 'Triplex', label: 'Triplex' },
                { value: 'Apartment', label: 'Apartment' },
                { value: 'Other', label: 'Other' },
              ]}
            />
            <FormField type="text" label="Square Feet" value={form.square_feet} onChange={v => set('square_feet', v)} placeholder="1,500" />
            <FormField type="text" label="Beds" value={form.beds} onChange={v => set('beds', v)} placeholder="3" />
            <FormField type="text" label="Baths" value={form.baths} onChange={v => set('baths', v)} placeholder="2" />
            <FormField type="text" label="Units" value={form.units} onChange={v => set('units', v)} placeholder="1" />
            <FormField type="text" label="Stories" value={form.stories} onChange={v => set('stories', v)} placeholder="2" />
            <FormField type="text" label="County" value={form.county} onChange={v => set('county', v)} placeholder="County" />
            <FormField type="text" label="Zoning" value={form.zoning} onChange={v => set('zoning', v)} placeholder="Residential" />
            <FormField type="text" label="Parcel Number" value={form.parcel_number} onChange={v => set('parcel_number', v)} placeholder="Parcel #" />
            <FormField type="text" label="Lot Size" value={form.lot_size} onChange={v => set('lot_size', v)} placeholder="e.g. 0.25 acres" />
            <FormField type="toggle" label="HOA" value={form.hoa} onChange={v => set('hoa', v)} />
          </div>
        </FormSection>

        <FormSection title="Financial Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <FormField type="text" label="Property Taxes" value={form.property_taxes} onChange={v => set('property_taxes', v)} placeholder="$2,500/yr" />
            <FormField type="text" label="Last Sale Date" value={form.last_sale_date} onChange={v => set('last_sale_date', v)} placeholder="MM/DD/YYYY" />
            <FormField type="text" label="Last Sale Price" value={form.last_sale_price} onChange={v => set('last_sale_price', v)} placeholder="$200,000" />
            <FormField type="text" label="Mortgage Amount" value={form.mortgage_amount} onChange={v => set('mortgage_amount', v)} placeholder="$150,000" />
            <FormField type="text" label="Mortgage Balance" value={form.mortgage_balance} onChange={v => set('mortgage_balance', v)} placeholder="$130,000" />
            <FormField type="text" label="LTV" value={form.ltv} onChange={v => set('ltv', v)} placeholder="65%" />
            <FormField type="text" label="AVM" value={form.avm} onChange={v => set('avm', v)} placeholder="$320,000" />
            <FormField type="text" label="Rental Value" value={form.rental_value} onChange={v => set('rental_value', v)} placeholder="$1,800/mo" />
            <FormField type="text" label="Assessed Value" value={form.assessed_value} onChange={v => set('assessed_value', v)} placeholder="$290,000" />
          </div>
        </FormSection>

        <FormSection title="Deal Automator Values">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <FormField type="text" label="Retail Value Estimate" value={form.retail_value_estimate} onChange={v => set('retail_value_estimate', v)} placeholder="$350,000" />
            <FormField type="text" label="Rental Value Estimate" value={form.rental_value_estimate} onChange={v => set('rental_value_estimate', v)} placeholder="$1,900/mo" />
            <FormField type="text" label="Wholesale Value Estimate" value={form.wholesale_value_estimate} onChange={v => set('wholesale_value_estimate', v)} placeholder="$260,000" />
            <FormField type="text" label="Retail Sellability Score" value={form.retail_sellability_score} onChange={v => set('retail_sellability_score', v)} placeholder="503" />
            <FormField type="text" label="Rental Sellability Score" value={form.rental_sellability_score} onChange={v => set('rental_sellability_score', v)} placeholder="297" />
            <FormField type="text" label="Wholesale Sellability Score" value={form.wholesale_sellability_score} onChange={v => set('wholesale_sellability_score', v)} placeholder="61" />
          </div>
        </FormSection>

        <FormSection title="Call Disposition">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <FormField
              type="select"
              label="Disposition"
              value={form.disposition}
              onChange={v => set('disposition', v as Disposition)}
              options={dispositionOptions}
            />
            <FormField
              type="date"
              label="Follow Up Date"
              value={form.follow_up_date || ''}
              onChange={v => set('follow_up_date', v || null)}
            />
            <FormField
              type="text"
              label="Submitted By"
              value={form.submitted_by}
              onChange={v => set('submitted_by', v)}
              readOnly={!editLead}
            />
            <FormField
              type="textarea"
              label="Notes"
              value={form.notes}
              onChange={v => set('notes', v)}
              placeholder="Add any call notes here..."
              rows={4}
              className="sm:col-span-2 lg:col-span-3"
            />
          </div>
        </FormSection>

        <div className="flex items-center gap-4 pt-2">
          <ShimmerButton type="submit" disabled={saving}>
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Saving...' : (editLead ? 'Save Changes' : 'Submit Lead')}
          </ShimmerButton>
          <button
            type="button"
            onClick={() => navigate('lead-list')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-body font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </Layout>
  );
}
