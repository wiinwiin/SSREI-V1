/*
  # SSREI CRM - Full Schema Migration

  ## Overview
  Creates all tables needed for the SSREI real estate wholesaling CRM.

  ## New Tables

  ### 1. import_batches
  Tracks CSV import sessions with summary counts.

  ### 2. contacts
  Core table storing all leads/contacts with full property data,
  distress scoring, DNC/Litigator flags, GHL sync status, and all
  contact person fields (3 contacts × 3 phones + emails each).

  ### 3. contact_activity_logs
  Immutable audit log of every action taken on a contact.

  ### 4. contact_notes
  Free-text notes attached to contacts.

  ### 5. contact_documents
  Document metadata attached to contacts (URLs to files).

  ### 6. offers
  Offer tracking per contact with negotiation notes.

  ### 7. buyers
  Cash buyer list with criteria for matching.

  ### 8. saved_filters
  Persisted filter configurations for the contacts list.

  ### 9. notifications
  In-app notification feed.

  ### 10. app_settings
  Key/value store for GHL API credentials and app configuration.

  ## Security
  RLS enabled on all tables. Authenticated users can read/write all records.
*/

-- =============================================
-- IMPORT BATCHES
-- =============================================
CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  uploaded_by text,
  uploaded_at timestamptz DEFAULT now(),
  total_rows integer DEFAULT 0,
  clean_count integer DEFAULT 0,
  dnc_count integer DEFAULT 0,
  litigator_count integer DEFAULT 0,
  duplicate_count integer DEFAULT 0,
  pushed_to_ghl_count integer DEFAULT 0,
  status text DEFAULT 'Processing'
);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select import_batches"
  ON import_batches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert import_batches"
  ON import_batches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update import_batches"
  ON import_batches FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete import_batches"
  ON import_batches FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- CONTACTS
-- =============================================
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL,
  batch_name text,

  -- Owner / Mailing
  first_name text,
  last_name text,
  mailing_address text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,

  -- Property
  property_address text,
  property_city text,
  property_state text,
  property_zip text,
  county text,
  property_type text,
  units text,
  beds text,
  baths text,
  sqft numeric,
  lot_size numeric,
  year_built numeric,
  house_style text,
  stories text,
  condition text,
  exterior text,
  roof text,
  basement text,
  garage text,
  heating text,
  air_conditioning text,
  pool boolean,
  patio boolean,
  porch boolean,
  fireplace boolean,
  water text,
  sewer text,
  zoning text,
  subdivision text,

  -- Deal Automator
  address_hash text,
  deal_automator_url text,

  -- Contact 1
  contact1_name text,
  contact1_type text,
  contact1_phone1 text,
  contact1_phone1_type text,
  contact1_phone2 text,
  contact1_phone2_type text,
  contact1_phone3 text,
  contact1_phone3_type text,
  contact1_email1 text,
  contact1_email2 text,
  contact1_email3 text,

  -- Contact 2
  contact2_name text,
  contact2_type text,
  contact2_phone1 text,
  contact2_phone1_type text,
  contact2_phone2 text,
  contact2_phone2_type text,
  contact2_phone3 text,
  contact2_phone3_type text,
  contact2_email1 text,
  contact2_email2 text,
  contact2_email3 text,

  -- Contact 3
  contact3_name text,
  contact3_type text,
  contact3_phone1 text,
  contact3_phone1_type text,
  contact3_phone2 text,
  contact3_phone2_type text,
  contact3_phone3 text,
  contact3_phone3_type text,
  contact3_email1 text,
  contact3_email2 text,
  contact3_email3 text,

  -- Status & Scoring
  dnc_toggle boolean DEFAULT false,
  litigator boolean DEFAULT false,
  overall_status text,
  distress_score integer DEFAULT 0,
  score_tier text,
  distress_flags text,
  priority_flag boolean DEFAULT false,

  -- Distress Indicators
  absentee_owner boolean,
  foreclosure_activity boolean,
  delinquent_tax boolean,
  high_equity boolean,
  free_and_clear boolean,
  upside_down boolean,
  long_term_owner boolean,
  potentially_inherited boolean,
  active_listing boolean,

  -- Financial
  avm numeric,
  wholesale_value numeric,
  market_value numeric,
  ltv numeric,
  estimated_mortgage_balance numeric,
  estimated_mortgage_payment numeric,
  mortgage_interest_rate numeric,
  loan_type text,
  loan_amount numeric,
  number_of_loans numeric,
  total_loans numeric,
  tax_amount numeric,
  hoa_fee numeric,
  hoa_name text,
  hoa_fee_frequency text,
  rental_estimate_low numeric,
  rental_estimate_high numeric,

  -- MLS Current
  mls_curr_listing_id text,
  mls_curr_status text,
  mls_curr_list_price numeric,
  mls_curr_sale_price numeric,
  mls_curr_days_on_market numeric,
  mls_curr_list_date date,
  mls_curr_sold_date date,
  mls_curr_description text,
  mls_curr_source text,
  mls_curr_agent_name text,
  mls_curr_office text,

  -- MLS Previous
  mls_prev_listing_id text,
  mls_prev_status text,
  mls_prev_list_price numeric,
  mls_prev_sale_price numeric,
  mls_prev_days_on_market numeric,
  mls_prev_list_date date,
  mls_prev_sold_date date,
  mls_prev_description text,
  mls_prev_source text,
  mls_prev_agent_name text,
  mls_prev_office text,

  -- CRM
  last_disposition text,
  follow_up_date date,
  skip_traced boolean DEFAULT false,
  source text DEFAULT 'CSV Import',
  source_detail text,
  created_by text,

  -- GHL
  pushed_to_ghl boolean DEFAULT false,
  ghl_contact_id text,
  ghl_opportunity_id text,
  ghl_stage text,
  tags text[],

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_address_hash_idx ON contacts(address_hash) WHERE address_hash IS NOT NULL AND address_hash != '';

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- CONTACT ACTIVITY LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS contact_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  address_hash text,
  action text,
  action_detail text,
  action_by text,
  action_at timestamptz DEFAULT now()
);

ALTER TABLE contact_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select contact_activity_logs"
  ON contact_activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contact_activity_logs"
  ON contact_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- CONTACT NOTES
-- =============================================
CREATE TABLE IF NOT EXISTS contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  note_text text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select contact_notes"
  ON contact_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contact_notes"
  ON contact_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contact_notes"
  ON contact_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete contact_notes"
  ON contact_notes FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- CONTACT DOCUMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS contact_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  document_name text,
  document_type text,
  document_url text,
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select contact_documents"
  ON contact_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contact_documents"
  ON contact_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete contact_documents"
  ON contact_documents FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- OFFERS
-- =============================================
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  offer_amount numeric,
  offer_date date,
  offer_status text DEFAULT 'Pending',
  counter_offer_amount numeric,
  negotiation_notes text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select offers"
  ON offers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update offers"
  ON offers FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete offers"
  ON offers FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- BUYERS
-- =============================================
CREATE TABLE IF NOT EXISTS buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  states text[],
  cities text[],
  min_units integer,
  max_units integer,
  min_price numeric,
  max_price numeric,
  property_types text[],
  notes text,
  active boolean DEFAULT true,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select buyers"
  ON buyers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert buyers"
  ON buyers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update buyers"
  ON buyers FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete buyers"
  ON buyers FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- SAVED FILTERS
-- =============================================
CREATE TABLE IF NOT EXISTS saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_name text NOT NULL,
  filter_config jsonb,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select saved_filters"
  ON saved_filters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert saved_filters"
  ON saved_filters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete saved_filters"
  ON saved_filters FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text,
  message text,
  contact_id uuid,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- APP SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select app_settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert app_settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update app_settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- USER PROFILES (for role management)
-- =============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  role text DEFAULT 'agent',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select any profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
