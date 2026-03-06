export type UserRole = 'admin' | 'agent' | 'viewer';

export interface UserProfile {
  id: string;
  display_name: string;
  full_name?: string;
  role: UserRole;
  email?: string;
  title?: string;
  permissions?: Record<string, boolean>;
  is_active?: boolean;
}

export interface RolePermissions {
  canViewSettings: boolean;
  canDelete: boolean;
  canInviteMembers: boolean;
  canChangeRoles: boolean;
  canEditContacts: boolean;
  canViewBuyers: boolean;
  canViewActivityLog: boolean;
  canImportLeads: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canViewSettings: true,
    canDelete: true,
    canInviteMembers: true,
    canChangeRoles: true,
    canEditContacts: true,
    canViewBuyers: true,
    canViewActivityLog: true,
    canImportLeads: true,
  },
  agent: {
    canViewSettings: false,
    canDelete: false,
    canInviteMembers: false,
    canChangeRoles: false,
    canEditContacts: true,
    canViewBuyers: true,
    canViewActivityLog: true,
    canImportLeads: true,
  },
  viewer: {
    canViewSettings: false,
    canDelete: false,
    canInviteMembers: false,
    canChangeRoles: false,
    canEditContacts: false,
    canViewBuyers: false,
    canViewActivityLog: false,
    canImportLeads: false,
  },
};

export type Page =
  | 'login'
  | 'dashboard'
  | 'lead-import'
  | 'contacts'
  | 'contact-detail'
  | 'pipeline'
  | 'opportunities'
  | 'buyers'
  | 'sellers'
  | 'activity-log'
  | 'notifications'
  | 'settings';

export interface RouterState {
  page: Page;
  contactId?: string;
}

export type ScoreTier = 'Hot' | 'Warm' | 'Lukewarm' | 'Cold' | 'No Signal';
export type OverallStatus = 'Clean' | 'DNC' | 'Litigator';
export type OfferStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Countered';
export type DocumentType = 'LOI' | 'Purchase Agreement' | 'Inspection Report' | 'Contract' | 'Other';
export type NotificationType = 'Hot Lead' | 'Push Failed' | 'Duplicate Detected' | 'General';
export type BatchStatus = 'Processing' | 'Complete' | 'Failed';

/** Per-person entry stored in the contacts_json JSONB column */
export interface ContactEntry {
  name: string;
  type: string;
  phones: { number: string; phoneType: string; dnc: boolean }[];
  emails: string[];
  dnc: boolean; // true if ALL phones are DNC (or row-level DNC)
}

export interface Contact {
  id: string;
  batch_id?: string;
  batch_name?: string;
  first_name?: string;
  last_name?: string;
  mailing_address?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  county?: string;
  property_type?: string;
  units?: string;
  beds?: string;
  baths?: string;
  sqft?: number;
  lot_size?: number;
  year_built?: number;
  house_style?: string;
  stories?: string;
  condition?: string;
  exterior?: string;
  roof?: string;
  basement?: string;
  garage?: string;
  heating?: string;
  air_conditioning?: string;
  pool?: boolean;
  patio?: boolean;
  porch?: boolean;
  fireplace?: boolean;
  water?: string;
  sewer?: string;
  zoning?: string;
  subdivision?: string;
  address_hash?: string;
  deal_automator_url?: string;

  contact1_name?: string;
  contact1_type?: string;
  contact1_phone1?: string;
  contact1_phone1_type?: string;
  contact1_phone2?: string;
  contact1_phone2_type?: string;
  contact1_phone3?: string;
  contact1_phone3_type?: string;
  contact1_email1?: string;
  contact1_email2?: string;
  contact1_email3?: string;

  contact2_name?: string;
  contact2_type?: string;
  contact2_phone1?: string;
  contact2_phone1_type?: string;
  contact2_phone2?: string;
  contact2_phone2_type?: string;
  contact2_phone3?: string;
  contact2_phone3_type?: string;
  contact2_email1?: string;
  contact2_email2?: string;
  contact2_email3?: string;

  contact3_name?: string;
  contact3_type?: string;
  contact3_phone1?: string;
  contact3_phone1_type?: string;
  contact3_phone2?: string;
  contact3_phone2_type?: string;
  contact3_phone3?: string;
  contact3_phone3_type?: string;
  contact3_email1?: string;
  contact3_email2?: string;
  contact3_email3?: string;

  // Parsed contacts JSONB array (populated at import from contact1/2/3 fields)
  contacts_json?: ContactEntry[];
  // Array of { phone, dnc } for each phone, used for GIN index querying
  dnc_flags?: { phone: string; dnc: boolean }[];
  // Count of contacts with dnc=false and a valid phone
  non_dnc_count?: number;

  dnc_toggle?: boolean;

  litigator?: boolean;
  overall_status?: string;
  distress_score?: number;
  score_tier?: string;
  distress_flags?: string;
  priority_flag?: boolean;

  absentee_owner?: boolean;
  foreclosure_activity?: boolean;
  delinquent_tax?: boolean;
  high_equity?: boolean;
  free_and_clear?: boolean;
  upside_down?: boolean;
  long_term_owner?: boolean;
  potentially_inherited?: boolean;
  active_listing?: boolean;

  avm?: number;
  wholesale_value?: number;
  market_value?: number;
  ltv?: number;
  estimated_mortgage_balance?: number;
  estimated_mortgage_payment?: number;
  mortgage_interest_rate?: number;
  loan_type?: string;
  loan_amount?: number;
  number_of_loans?: number;
  total_loans?: number;
  tax_amount?: number;
  hoa?: boolean;
  hoa_fee?: number;
  hoa_name?: string;
  hoa_fee_frequency?: string;
  lender_name?: string;
  recording_date?: string;
  maturity_date?: string;
  rental_estimate_low?: number;
  rental_estimate_high?: number;

  mls_curr_listing_id?: string;
  mls_curr_status?: string;
  mls_curr_list_price?: number;
  mls_curr_sale_price?: number;
  mls_curr_days_on_market?: number;
  mls_curr_list_date?: string;
  mls_curr_sold_date?: string;
  mls_curr_description?: string;
  mls_curr_source?: string;
  mls_curr_agent_name?: string;
  mls_curr_office?: string;

  mls_prev_listing_id?: string;
  mls_prev_status?: string;
  mls_prev_list_price?: number;
  mls_prev_sale_price?: number;
  mls_prev_days_on_market?: number;
  mls_prev_list_date?: string;
  mls_prev_sold_date?: string;
  mls_prev_description?: string;
  mls_prev_source?: string;
  mls_prev_agent_name?: string;
  mls_prev_office?: string;

  last_disposition?: string;
  follow_up_date?: string;
  skip_traced?: boolean;
  source?: string;
  source_detail?: string;
  asking_price?: number;
  lead_source_detail?: string;
  lead_type?: 'commercial' | 'acquisition';
  property_name?: string;
  retail_score?: number;
  rental_score?: number;
  wholesale_score?: number;
  retail_sellability_score?: number;
  rental_sellability_score?: number;
  wholesale_sellability_score?: number;
  created_by?: string;
  pushed_to_ghl?: boolean;
  ghl_contact_id?: string;
  ghl_opportunity_id?: string;
  ghl_stage?: string;
  ghl_sync_status?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ImportBatch {
  id: string;
  batch_name: string;
  uploaded_by?: string;
  uploaded_at?: string;
  total_rows?: number;
  clean_count?: number;
  dnc_count?: number;
  litigator_count?: number;
  duplicate_count?: number;
  pushed_to_ghl_count?: number;
  status?: string;
}

export interface ContactActivityLog {
  id: string;
  contact_id?: string;
  address_hash?: string;
  action?: string;
  action_detail?: string;
  action_by?: string;
  action_at?: string;
  contacts?: { first_name?: string; last_name?: string; property_address?: string };
}

export interface ContactNote {
  id: string;
  contact_id?: string;
  note_text?: string;
  created_by?: string;
  created_at?: string;
}

export interface ContactDocument {
  id: string;
  contact_id?: string;
  document_name?: string;
  document_type?: string;
  document_url?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
}

export interface Offer {
  id: string;
  contact_id?: string;
  offer_amount?: number;
  offer_date?: string;
  offer_status?: string;
  counter_offer_amount?: number;
  negotiation_notes?: string;
  created_by?: string;
  created_at?: string;
}

export interface Buyer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  states?: string[];
  cities?: string[];
  min_units?: number;
  max_units?: number;
  min_price?: number;
  max_price?: number;
  property_types?: string[];
  notes?: string;
  active?: boolean;
  is_active?: boolean;
  created_by?: string;
  created_at?: string;
}

export interface Notification {
  id: string;
  type?: string;
  message?: string;
  contact_id?: string;
  read?: boolean;
  created_at?: string;
}

export interface AppSetting {
  id: string;
  key: string;
  value?: string;
  updated_at?: string;
}

export interface SavedFilter {
  id: string;
  filter_name: string;
  filter_config?: Record<string, unknown>;
  created_by?: string;
  created_at?: string;
}

export interface GHLSettings {
  api_key?: string;
  location_id?: string;
  pipeline_id?: string;
  [key: string]: string | undefined;
}

export interface CSVRow {
  [key: string]: string;
}

export interface ProcessedRow {
  contact: Partial<Contact>;
  originalRow: CSVRow;
  status: OverallStatus;
  distress_score: number;
  score_tier: ScoreTier;
}

export type Disposition =
  | 'Customer Reached'
  | 'No Answer'
  | 'Left Voicemail'
  | 'Callback Requested'
  | 'Not Interested'
  | 'Wrong Number'
  | 'Follow Up'
  | 'Bad Email'
  | 'DNC';

export interface Lead {
  id: string;
  owner_name: string;
  phone: string;
  email: string;
  dnc: boolean;
  owner_type: 'Individual' | 'LLC' | 'Corporation' | 'Trust';
  lead_type: 'acquisition' | 'commercial';
  length_of_ownership: string;
  estimated_equity: string;
  absentee_owner: boolean;
  out_of_state_owner: boolean;
  mailing_address: string;
  property_address: string;
  city: string;
  state: string;
  zip: string;
  home_type: 'Single Family' | 'Multifamily' | 'Duplex' | 'Triplex' | 'Apartment' | 'Other';
  square_feet: string;
  beds: string;
  baths: string;
  units: string;
  stories: string;
  county: string;
  zoning: string;
  parcel_number: string;
  lot_size: string;
  hoa: boolean;
  property_taxes: string;
  last_sale_date: string;
  last_sale_price: string;
  mortgage_amount: string;
  mortgage_balance: string;
  ltv: string;
  avm: string;
  rental_value: string;
  assessed_value: string;
  retail_value_estimate: string;
  rental_value_estimate: string;
  wholesale_value_estimate: string;
  retail_sellability_score: string;
  rental_sellability_score: string;
  wholesale_sellability_score: string;
  disposition: Disposition;
  notes: string;
  follow_up_date: string | null;
  submitted_by: string;
  ghl_contact_id: string;
  ghl_opportunity_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeadFormData {
  owner_name: string;
  phone: string;
  email: string;
  dnc: boolean;
  owner_type: 'Individual' | 'LLC' | 'Corporation' | 'Trust';
  lead_type: 'acquisition' | 'commercial';
  length_of_ownership: string;
  estimated_equity: string;
  absentee_owner: boolean;
  out_of_state_owner: boolean;
  mailing_address: string;
  property_address: string;
  city: string;
  state: string;
  zip: string;
  home_type: 'Single Family' | 'Multifamily' | 'Duplex' | 'Triplex' | 'Apartment' | 'Other';
  square_feet: string;
  beds: string;
  baths: string;
  units: string;
  stories: string;
  county: string;
  zoning: string;
  parcel_number: string;
  lot_size: string;
  hoa: boolean;
  property_taxes: string;
  last_sale_date: string;
  last_sale_price: string;
  mortgage_amount: string;
  mortgage_balance: string;
  ltv: string;
  avm: string;
  rental_value: string;
  assessed_value: string;
  retail_value_estimate: string;
  rental_value_estimate: string;
  wholesale_value_estimate: string;
  retail_sellability_score: string;
  rental_sellability_score: string;
  wholesale_sellability_score: string;
  disposition: Disposition;
  notes: string;
  follow_up_date: string | null;
  submitted_by: string;
  ghl_contact_id: string;
  ghl_opportunity_id: string;
}
