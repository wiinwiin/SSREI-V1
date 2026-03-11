

-- ==========================================
-- FILE: 20260220174444_create_ssrei_tables.sql
-- ==========================================

/*
  # SSREI Real Estate Wholesaling App - Initial Schema

  ## Overview
  Creates the core tables for the SSREI wholesaling team app.

  ## Tables

  ### leads
  Stores all real estate lead information including:
  - Owner information (name, type, equity, etc.)
  - Property details (address, type, size, etc.)
  - Financial data (taxes, mortgage, valuations)
  - Deal automator values (retail/rental/wholesale estimates and scores)
  - Call disposition (status, notes, follow-up dates)
  - GHL sync tracking (contact ID)

  ### settings
  Stores GoHighLevel API configuration:
  - ghl_api_key: API key for authentication
  - ghl_location_id: GHL location identifier
  - ghl_pipeline_id: Pipeline ID for stage management

  ## Security
  - RLS enabled on both tables
  - Anon role allowed full access (internal team tool with client-side auth)
*/

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Owner Information
  owner_name text NOT NULL DEFAULT '',
  owner_type text NOT NULL DEFAULT 'Individual',
  length_of_ownership text DEFAULT '',
  estimated_equity text DEFAULT '',
  absentee_owner boolean DEFAULT false,
  out_of_state_owner boolean DEFAULT false,
  mailing_address text DEFAULT '',
  -- Property Information
  property_address text NOT NULL DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  zip text DEFAULT '',
  home_type text DEFAULT 'Single Family',
  square_feet text DEFAULT '',
  beds text DEFAULT '',
  baths text DEFAULT '',
  units text DEFAULT '',
  stories text DEFAULT '',
  county text DEFAULT '',
  zoning text DEFAULT '',
  parcel_number text DEFAULT '',
  lot_size text DEFAULT '',
  hoa boolean DEFAULT false,
  -- Financial Information
  property_taxes text DEFAULT '',
  last_sale_date text DEFAULT '',
  last_sale_price text DEFAULT '',
  mortgage_amount text DEFAULT '',
  mortgage_balance text DEFAULT '',
  ltv text DEFAULT '',
  avm text DEFAULT '',
  rental_value text DEFAULT '',
  assessed_value text DEFAULT '',
  -- Deal Automator Values
  retail_value_estimate text DEFAULT '',
  rental_value_estimate text DEFAULT '',
  wholesale_value_estimate text DEFAULT '',
  retail_sellability_score text DEFAULT '',
  rental_sellability_score text DEFAULT '',
  wholesale_sellability_score text DEFAULT '',
  -- Call Disposition
  disposition text NOT NULL DEFAULT 'Customer Reached',
  notes text DEFAULT '',
  follow_up_date date,
  submitted_by text NOT NULL DEFAULT '',
  -- GHL Integration
  ghl_contact_id text DEFAULT '',
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_api_key text DEFAULT '',
  ghl_location_id text DEFAULT '',
  ghl_pipeline_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings row
INSERT INTO settings (ghl_api_key, ghl_location_id, ghl_pipeline_id)
SELECT '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM settings);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policies for leads (internal tool - allow anon full access)
DROP POLICY IF EXISTS "Allow anon select on leads" ON leads;
CREATE POLICY "Allow anon select on leads"
  ON leads FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert on leads" ON leads;
CREATE POLICY "Allow anon insert on leads"
  ON leads FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update on leads" ON leads;
CREATE POLICY "Allow anon update on leads"
  ON leads FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete on leads" ON leads;
CREATE POLICY "Allow anon delete on leads"
  ON leads FOR DELETE
  TO anon
  USING (true);

-- Policies for settings
DROP POLICY IF EXISTS "Allow anon select on settings" ON settings;
CREATE POLICY "Allow anon select on settings"
  ON settings FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert on settings" ON settings;
CREATE POLICY "Allow anon insert on settings"
  ON settings FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update on settings" ON settings;
CREATE POLICY "Allow anon update on settings"
  ON settings FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- FILE: 20260220214215_add_ghl_opportunity_id_to_leads.sql
-- ==========================================

/*
  # Add GHL Opportunity ID to Leads

  ## Changes
  - Adds `ghl_opportunity_id` column to the `leads` table to store the GoHighLevel opportunity ID
    created when a lead is submitted, enabling future deletion/update of that opportunity via the GHL API.

  ## Notes
  - Column is nullable with a default empty string to maintain backwards compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'ghl_opportunity_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN ghl_opportunity_id text DEFAULT '';
  END IF;
END $$;


-- ==========================================
-- FILE: 20260220231019_add_phone_email_to_leads.sql
-- ==========================================

/*
  # Add phone and email fields to leads table

  1. Changes
    - `leads` table: add `phone` (text) and `email` (text) columns
      - Both nullable with empty string default
      - Used to sync contact info to GHL as proper contact fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'phone'
  ) THEN
    ALTER TABLE leads ADD COLUMN phone text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'email'
  ) THEN
    ALTER TABLE leads ADD COLUMN email text NOT NULL DEFAULT '';
  END IF;
END $$;


-- ==========================================
-- FILE: 20260220233635_add_dnc_field_to_leads.sql
-- ==========================================

/*
  # Add dnc (Do Not Call) field to leads table

  1. Changes
    - `leads` table: add `dnc` (boolean) column, default false
      - Tracks whether a contact has been marked Do Not Call
      - Separate from disposition to allow independent DNC toggle
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'dnc'
  ) THEN
    ALTER TABLE leads ADD COLUMN dnc boolean NOT NULL DEFAULT false;
  END IF;
END $$;


-- ==========================================
-- FILE: 20260223190113_create_ssrei_crm_tables.sql
-- ==========================================

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

DROP POLICY IF EXISTS "Authenticated users can select import_batches" ON import_batches;
CREATE POLICY "Authenticated users can select import_batches"
  ON import_batches FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert import_batches" ON import_batches;
CREATE POLICY "Authenticated users can insert import_batches"
  ON import_batches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update import_batches" ON import_batches;
CREATE POLICY "Authenticated users can update import_batches"
  ON import_batches FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete import_batches" ON import_batches;
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

DROP POLICY IF EXISTS "Authenticated users can select contacts" ON contacts;
CREATE POLICY "Authenticated users can select contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON contacts;
CREATE POLICY "Authenticated users can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update contacts" ON contacts;
CREATE POLICY "Authenticated users can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON contacts;
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

DROP POLICY IF EXISTS "Authenticated users can select contact_activity_logs" ON contact_activity_logs;
CREATE POLICY "Authenticated users can select contact_activity_logs"
  ON contact_activity_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert contact_activity_logs" ON contact_activity_logs;
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

DROP POLICY IF EXISTS "Authenticated users can select contact_notes" ON contact_notes;
CREATE POLICY "Authenticated users can select contact_notes"
  ON contact_notes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert contact_notes" ON contact_notes;
CREATE POLICY "Authenticated users can insert contact_notes"
  ON contact_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update contact_notes" ON contact_notes;
CREATE POLICY "Authenticated users can update contact_notes"
  ON contact_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete contact_notes" ON contact_notes;
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

DROP POLICY IF EXISTS "Authenticated users can select contact_documents" ON contact_documents;
CREATE POLICY "Authenticated users can select contact_documents"
  ON contact_documents FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert contact_documents" ON contact_documents;
CREATE POLICY "Authenticated users can insert contact_documents"
  ON contact_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete contact_documents" ON contact_documents;
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

DROP POLICY IF EXISTS "Authenticated users can select offers" ON offers;
CREATE POLICY "Authenticated users can select offers"
  ON offers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert offers" ON offers;
CREATE POLICY "Authenticated users can insert offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update offers" ON offers;
CREATE POLICY "Authenticated users can update offers"
  ON offers FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete offers" ON offers;
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

DROP POLICY IF EXISTS "Authenticated users can select buyers" ON buyers;
CREATE POLICY "Authenticated users can select buyers"
  ON buyers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert buyers" ON buyers;
CREATE POLICY "Authenticated users can insert buyers"
  ON buyers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update buyers" ON buyers;
CREATE POLICY "Authenticated users can update buyers"
  ON buyers FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete buyers" ON buyers;
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

DROP POLICY IF EXISTS "Authenticated users can select saved_filters" ON saved_filters;
CREATE POLICY "Authenticated users can select saved_filters"
  ON saved_filters FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert saved_filters" ON saved_filters;
CREATE POLICY "Authenticated users can insert saved_filters"
  ON saved_filters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete saved_filters" ON saved_filters;
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

DROP POLICY IF EXISTS "Authenticated users can select notifications" ON notifications;
CREATE POLICY "Authenticated users can select notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update notifications" ON notifications;
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

DROP POLICY IF EXISTS "Authenticated users can select app_settings" ON app_settings;
CREATE POLICY "Authenticated users can select app_settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert app_settings" ON app_settings;
CREATE POLICY "Authenticated users can insert app_settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update app_settings" ON app_settings;
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

DROP POLICY IF EXISTS "Users can select any profile" ON user_profiles;
CREATE POLICY "Users can select any profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ==========================================
-- FILE: 20260223191506_auto_create_user_profile_on_signup.sql
-- ==========================================

/*
  # Auto-create user profile on Supabase Auth signup

  ## Overview
  Creates a PostgreSQL trigger that automatically inserts a row into
  user_profiles whenever a new user is created in auth.users.

  ## New Objects
  - Function: handle_new_user() — inserts into user_profiles with role 'agent'
  - Trigger: on_auth_user_created — fires after INSERT on auth.users

  ## Notes
  - Default role is 'agent'
  - Admin role must be set manually in user_profiles table
  - display_name defaults to the email prefix (before @)
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==========================================
-- FILE: 20260223195106_set_all_users_admin_and_default_role.sql
-- ==========================================

/*
  # Set all users to Admin role

  ## Changes
  - Updates all existing user_profiles to role = 'admin'
  - Changes the default role for new signups to 'admin'
  - This means all 4 team members (Sherwin, Fae, Kristi, Liely) are admins
*/

UPDATE public.user_profiles SET role = 'admin';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ==========================================
-- FILE: 20260223200214_update_user_profiles_role_system.sql
-- ==========================================

/*
  # Update user_profiles table for full role system

  ## Changes
  - Add `full_name` column (text) - user's full name
  - Add `title` column (text) - job title e.g. "GHL Workflow Builder"
  - Add `permissions` column (jsonb) - custom permission overrides
  - Add `is_active` column (boolean, default true) - soft deactivation
  - Rename-safe: `display_name` kept for backward compat; full_name is new
  - Alter `role` column to support 'admin' | 'agent' | 'viewer'
  - Update all existing users to admin
  - Update handle_new_user() trigger to default new signups to admin

  ## Security
  - RLS already enabled; existing policies kept
  - Add policy for users to read all profiles (needed for team management UI)
  - Admin users can update any profile
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN full_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'title'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN title text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN permissions jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email text;
  END IF;
END $$;

UPDATE user_profiles SET role = 'admin', is_active = true WHERE role != 'admin';
UPDATE user_profiles SET is_active = true WHERE is_active IS NULL;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, full_name, email, role, is_active, permissions)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'admin',
    true,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    is_active = COALESCE(user_profiles.is_active, true);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON user_profiles;
CREATE POLICY "Users can read all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin users can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Admin users can update any profile" ON user_profiles;
CREATE POLICY "Admin users can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );


-- ==========================================
-- FILE: 20260223205315_add_contact_loan_fields_only.sql
-- ==========================================

/*
  # Add Contact Loan Detail Fields

  Adds additional financial/loan fields to the contacts table
  that were missing: lender_name, recording_date, maturity_date, hoa.
  All are optional and safe to add with IF NOT EXISTS checks.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'lender_name') THEN
    ALTER TABLE contacts ADD COLUMN lender_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'recording_date') THEN
    ALTER TABLE contacts ADD COLUMN recording_date text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'maturity_date') THEN
    ALTER TABLE contacts ADD COLUMN maturity_date text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'hoa') THEN
    ALTER TABLE contacts ADD COLUMN hoa boolean DEFAULT false;
  END IF;
END $$;


-- ==========================================
-- FILE: 20260223212823_add_ghl_sync_status_to_contacts.sql
-- ==========================================

/*
  # Add GHL Sync Status Column to Contacts

  Adds `ghl_sync_status` (text) to the contacts table to track whether
  each contact has been successfully synced to GoHighLevel.

  Values: null (not attempted), 'Synced', 'Failed', 'Syncing'
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'ghl_sync_status') THEN
    ALTER TABLE contacts ADD COLUMN ghl_sync_status text;
  END IF;
END $$;


-- ==========================================
-- FILE: 20260223220029_add_is_active_to_buyers.sql
-- ==========================================

/*
  # Add is_active column to buyers (alias for active)

  The existing buyers table uses `active` column. We add `is_active` as a
  generated/alias column for forward compatibility with the new UI code,
  OR we simply ensure both work. We'll add is_active if it doesn't exist
  and sync it.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buyers' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE buyers ADD COLUMN is_active boolean DEFAULT true;
    UPDATE buyers SET is_active = active WHERE is_active IS NULL;
  END IF;
END $$;


-- ==========================================
-- FILE: 20260223221101_add_is_read_and_user_id_to_notifications.sql
-- ==========================================

/*
  # Extend notifications table

  ## Changes
  - Add `is_read` column (boolean, default false) as canonical read-status field
    alongside existing `read` column for backward compatibility
  - Add `user_id` column (uuid, nullable) so per-user filtering is possible
  - Sync existing `read` values to `is_read`

  ## Notes
  - Both `read` and `is_read` are kept in sync by the application layer
  - RLS is already enabled on this table from the original migration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN is_read boolean DEFAULT false;
    UPDATE notifications SET is_read = COALESCE(read, false);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN user_id uuid;
  END IF;
END $$;


-- ==========================================
-- FILE: 20260225135358_add_sellers_table.sql
-- ==========================================

/*
  # Add Sellers Table

  1. New Tables
    - `sellers`
      - `id` (uuid, primary key)
      - `name` (text) - Seller's full name
      - `email` (text) - Contact email
      - `phone` (text) - Contact phone
      - `company` (text) - Company name
      - `property_types` (text[]) - Types of properties they're interested in
      - `target_areas` (text[]) - Geographic areas of interest
      - `min_budget` (numeric) - Minimum budget
      - `max_budget` (numeric) - Maximum budget
      - `notes` (text) - Additional notes
      - `status` (text) - Status: active, inactive, pending
      - `is_active` (boolean) - Quick filter for active sellers
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - User who created the record

  2. Security
    - Enable RLS on `sellers` table
    - Add policies for authenticated users to manage sellers
*/

CREATE TABLE IF NOT EXISTS sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  property_types text[] DEFAULT '{}',
  target_areas text[] DEFAULT '{}',
  min_budget numeric DEFAULT 0,
  max_budget numeric DEFAULT 0,
  notes text DEFAULT '',
  status text DEFAULT 'active',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view sellers" ON sellers;
CREATE POLICY "Authenticated users can view sellers"
  ON sellers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert sellers" ON sellers;
CREATE POLICY "Authenticated users can insert sellers"
  ON sellers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update sellers" ON sellers;
CREATE POLICY "Authenticated users can update sellers"
  ON sellers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete sellers" ON sellers;
CREATE POLICY "Authenticated users can delete sellers"
  ON sellers
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_sellers_is_active ON sellers(is_active);
CREATE INDEX IF NOT EXISTS idx_sellers_created_at ON sellers(created_at DESC);

-- ==========================================
-- FILE: 20260225182450_add_seller_fields_to_contacts.sql
-- ==========================================

/*
  # Add Seller-Specific Fields to Contacts

  1. New Columns
    - `asking_price` (numeric) - Seller's asking price for the property
    - `lead_source_detail` (text) - Detailed source information for the lead

  2. Changes
    - These fields integrate with GHL custom fields:
      - Seller Asking Price → contact.seller_asking_price
      - Seller Lead Source → contact.seller_lead_source
      - Seller Property Address → already mapped to property_address
      - Seller Property Year Built → already mapped to year_built
      - Seller Property Estimated Value → already mapped to avm/market_value

  3. Notes
    - Fields are nullable to support existing records
    - No default values to distinguish between "not set" and "0"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'asking_price'
  ) THEN
    ALTER TABLE contacts ADD COLUMN asking_price numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'lead_source_detail'
  ) THEN
    ALTER TABLE contacts ADD COLUMN lead_source_detail text;
  END IF;
END $$;

-- ==========================================
-- FILE: 20260226221016_add_commercial_lead_fields.sql
-- ==========================================

/*
  # Add Commercial Lead Support

  1. New Columns
    - `lead_type` (text) - 'commercial' or 'acquisition' 
    - `property_name` (text) - For commercial properties (replaces first/last name)
    - `retail_score` (numeric) - RetailScore from Deal Automator
    - `rental_score` (numeric) - RentalScore from Deal Automator
    - `wholesale_score` (numeric) - WholesaleScore from Deal Automator

  2. Purpose
    - Support both commercial and acquisition leads from CSV imports
    - Store Deal Automator scores for better lead qualification
    - Distinguish between property-based (commercial) and owner-based (acquisition) leads

  3. Notes
    - All fields are nullable to support existing data
    - Scores help with lead prioritization
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'lead_type'
  ) THEN
    ALTER TABLE contacts ADD COLUMN lead_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'property_name'
  ) THEN
    ALTER TABLE contacts ADD COLUMN property_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'retail_score'
  ) THEN
    ALTER TABLE contacts ADD COLUMN retail_score numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'rental_score'
  ) THEN
    ALTER TABLE contacts ADD COLUMN rental_score numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'wholesale_score'
  ) THEN
    ALTER TABLE contacts ADD COLUMN wholesale_score numeric;
  END IF;
END $$;


-- ==========================================
-- FILE: 20260226223210_add_lead_type_to_leads_table.sql
-- ==========================================

/*
  # Add lead_type field to leads table

  1. Changes
    - Add `lead_type` column to `leads` table
      - Type: text
      - Values: 'acquisition' or 'commercial'
      - Default: 'acquisition'
    - Set default value for existing leads

  2. Notes
    - This enables filtering by lead type for manual entries
    - Matches the field already present in contacts table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'lead_type'
  ) THEN
    ALTER TABLE leads ADD COLUMN lead_type text DEFAULT 'acquisition';
  END IF;
END $$;

-- ==========================================
-- FILE: 20260227005601_create_bulk_upsert_contacts_function.sql
-- ==========================================

/*
  # Create Bulk Upsert Contacts Function
  
  1. New Functions
    - `bulk_upsert_contacts` - High-performance bulk insert for contact imports
      - Accepts JSON array of contacts
      - Uses INSERT with ON CONFLICT for deduplication
      - Returns array of inserted contact IDs
  
  2. Performance
    - Handles 2000+ contacts per call
    - Single database round-trip
    - Automatic duplicate handling via property_address + property_city matching
*/

CREATE OR REPLACE FUNCTION bulk_upsert_contacts(contacts_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_ids jsonb := '[]'::jsonb;
BEGIN
  WITH inserted AS (
    INSERT INTO contacts (
      first_name, last_name, property_name, lead_type,
      property_address, property_city, property_state, property_zip,
      mailing_address, mailing_city, mailing_state, mailing_zip,
      contact1_name, contact1_type, contact1_phone1, contact1_phone2, contact1_phone3,
      contact1_phone1_type, contact1_phone2_type, contact1_phone3_type,
      contact1_email1, contact1_email2, contact1_email3,
      contact2_name, contact2_type, contact2_phone1, contact2_phone2, contact2_phone3,
      contact2_phone1_type, contact2_phone2_type, contact2_phone3_type,
      contact2_email1, contact2_email2, contact2_email3,
      contact3_name, contact3_type, contact3_phone1, contact3_phone2, contact3_phone3,
      contact3_phone1_type, contact3_phone2_type, contact3_phone3_type,
      contact3_email1, contact3_email2, contact3_email3,
      batch_id, batch_name, dnc_toggle, litigator, overall_status,
      distress_score, score_tier, distress_flags, deal_automator_url,
      source, created_by, pushed_to_ghl, tags,
      beds, baths, sqft, year_built, lot_size, avm, market_value,
      wholesale_value, rental_estimate_low, rental_estimate_high,
      loan_amount, loan_type, estimated_mortgage_balance, estimated_mortgage_payment,
      tax_amount, owner_type, absentee_owner, foreclosure_activity,
      delinquent_tax, high_equity, free_and_clear, upside_down,
      long_term_owner, potentially_inherited, active_listing,
      retail_sellability_score, rental_sellability_score, wholesale_sellability_score,
      address_hash
    )
    SELECT
      (c->>'first_name')::text,
      (c->>'last_name')::text,
      (c->>'property_name')::text,
      (c->>'lead_type')::text,
      (c->>'property_address')::text,
      (c->>'property_city')::text,
      (c->>'property_state')::text,
      (c->>'property_zip')::text,
      (c->>'mailing_address')::text,
      (c->>'mailing_city')::text,
      (c->>'mailing_state')::text,
      (c->>'mailing_zip')::text,
      (c->>'contact1_name')::text,
      (c->>'contact1_type')::text,
      (c->>'contact1_phone1')::text,
      (c->>'contact1_phone2')::text,
      (c->>'contact1_phone3')::text,
      (c->>'contact1_phone1_type')::text,
      (c->>'contact1_phone2_type')::text,
      (c->>'contact1_phone3_type')::text,
      (c->>'contact1_email1')::text,
      (c->>'contact1_email2')::text,
      (c->>'contact1_email3')::text,
      (c->>'contact2_name')::text,
      (c->>'contact2_type')::text,
      (c->>'contact2_phone1')::text,
      (c->>'contact2_phone2')::text,
      (c->>'contact2_phone3')::text,
      (c->>'contact2_phone1_type')::text,
      (c->>'contact2_phone2_type')::text,
      (c->>'contact2_phone3_type')::text,
      (c->>'contact2_email1')::text,
      (c->>'contact2_email2')::text,
      (c->>'contact2_email3')::text,
      (c->>'contact3_name')::text,
      (c->>'contact3_type')::text,
      (c->>'contact3_phone1')::text,
      (c->>'contact3_phone2')::text,
      (c->>'contact3_phone3')::text,
      (c->>'contact3_phone1_type')::text,
      (c->>'contact3_phone2_type')::text,
      (c->>'contact3_phone3_type')::text,
      (c->>'contact3_email1')::text,
      (c->>'contact3_email2')::text,
      (c->>'contact3_email3')::text,
      (c->>'batch_id')::uuid,
      (c->>'batch_name')::text,
      (c->>'dnc_toggle')::boolean,
      (c->>'litigator')::boolean,
      (c->>'overall_status')::text,
      (c->>'distress_score')::integer,
      (c->>'score_tier')::text,
      (c->>'distress_flags')::text,
      (c->>'deal_automator_url')::text,
      (c->>'source')::text,
      (c->>'created_by')::text,
      (c->>'pushed_to_ghl')::boolean,
      COALESCE((c->>'tags')::jsonb, '[]'::jsonb),
      (c->>'beds')::integer,
      (c->>'baths')::numeric,
      (c->>'sqft')::integer,
      (c->>'year_built')::integer,
      (c->>'lot_size')::integer,
      (c->>'avm')::numeric,
      (c->>'market_value')::numeric,
      (c->>'wholesale_value')::numeric,
      (c->>'rental_estimate_low')::numeric,
      (c->>'rental_estimate_high')::numeric,
      (c->>'loan_amount')::numeric,
      (c->>'loan_type')::text,
      (c->>'estimated_mortgage_balance')::numeric,
      (c->>'estimated_mortgage_payment')::numeric,
      (c->>'tax_amount')::numeric,
      (c->>'owner_type')::text,
      (c->>'absentee_owner')::boolean,
      (c->>'foreclosure_activity')::boolean,
      (c->>'delinquent_tax')::boolean,
      (c->>'high_equity')::boolean,
      (c->>'free_and_clear')::boolean,
      (c->>'upside_down')::boolean,
      (c->>'long_term_owner')::boolean,
      (c->>'potentially_inherited')::boolean,
      (c->>'active_listing')::boolean,
      (c->>'retail_sellability_score')::integer,
      (c->>'rental_sellability_score')::integer,
      (c->>'wholesale_sellability_score')::integer,
      (c->>'address_hash')::text
    FROM jsonb_array_elements(contacts_data) AS c
    ON CONFLICT (property_address, property_city) 
    WHERE property_address IS NOT NULL AND property_city IS NOT NULL
    DO NOTHING
    RETURNING id
  )
  SELECT jsonb_agg(id) INTO inserted_ids FROM inserted;
  
  RETURN COALESCE(inserted_ids, '[]'::jsonb);
END;
$$;

-- ==========================================
-- FILE: 20260227010128_fix_bulk_upsert_contacts_function.sql
-- ==========================================

/*
  # Fix Bulk Upsert Contacts Function
  
  1. Changes
    - Remove ON CONFLICT (no unique constraint exists)
    - Add duplicate checking logic within function
    - Filter out contacts that already exist based on property_address + property_city
  
  2. Performance
    - Still handles 2000+ contacts per call
    - Single database operation for inserts
    - Duplicate detection done in single query
*/

CREATE OR REPLACE FUNCTION bulk_upsert_contacts(contacts_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_ids jsonb := '[]'::jsonb;
BEGIN
  -- Insert only non-duplicate contacts
  WITH inserted AS (
    INSERT INTO contacts (
      first_name, last_name, property_name, lead_type,
      property_address, property_city, property_state, property_zip,
      mailing_address, mailing_city, mailing_state, mailing_zip,
      contact1_name, contact1_type, contact1_phone1, contact1_phone2, contact1_phone3,
      contact1_phone1_type, contact1_phone2_type, contact1_phone3_type,
      contact1_email1, contact1_email2, contact1_email3,
      contact2_name, contact2_type, contact2_phone1, contact2_phone2, contact2_phone3,
      contact2_phone1_type, contact2_phone2_type, contact2_phone3_type,
      contact2_email1, contact2_email2, contact2_email3,
      contact3_name, contact3_type, contact3_phone1, contact3_phone2, contact3_phone3,
      contact3_phone1_type, contact3_phone2_type, contact3_phone3_type,
      contact3_email1, contact3_email2, contact3_email3,
      batch_id, batch_name, dnc_toggle, litigator, overall_status,
      distress_score, score_tier, distress_flags, deal_automator_url,
      source, created_by, pushed_to_ghl, tags,
      beds, baths, sqft, year_built, lot_size, avm, market_value,
      wholesale_value, rental_estimate_low, rental_estimate_high,
      loan_amount, loan_type, estimated_mortgage_balance, estimated_mortgage_payment,
      tax_amount, owner_type, absentee_owner, foreclosure_activity,
      delinquent_tax, high_equity, free_and_clear, upside_down,
      long_term_owner, potentially_inherited, active_listing,
      retail_sellability_score, rental_sellability_score, wholesale_sellability_score,
      address_hash
    )
    SELECT
      (c->>'first_name')::text,
      (c->>'last_name')::text,
      (c->>'property_name')::text,
      (c->>'lead_type')::text,
      (c->>'property_address')::text,
      (c->>'property_city')::text,
      (c->>'property_state')::text,
      (c->>'property_zip')::text,
      (c->>'mailing_address')::text,
      (c->>'mailing_city')::text,
      (c->>'mailing_state')::text,
      (c->>'mailing_zip')::text,
      (c->>'contact1_name')::text,
      (c->>'contact1_type')::text,
      (c->>'contact1_phone1')::text,
      (c->>'contact1_phone2')::text,
      (c->>'contact1_phone3')::text,
      (c->>'contact1_phone1_type')::text,
      (c->>'contact1_phone2_type')::text,
      (c->>'contact1_phone3_type')::text,
      (c->>'contact1_email1')::text,
      (c->>'contact1_email2')::text,
      (c->>'contact1_email3')::text,
      (c->>'contact2_name')::text,
      (c->>'contact2_type')::text,
      (c->>'contact2_phone1')::text,
      (c->>'contact2_phone2')::text,
      (c->>'contact2_phone3')::text,
      (c->>'contact2_phone1_type')::text,
      (c->>'contact2_phone2_type')::text,
      (c->>'contact2_phone3_type')::text,
      (c->>'contact2_email1')::text,
      (c->>'contact2_email2')::text,
      (c->>'contact2_email3')::text,
      (c->>'contact3_name')::text,
      (c->>'contact3_type')::text,
      (c->>'contact3_phone1')::text,
      (c->>'contact3_phone2')::text,
      (c->>'contact3_phone3')::text,
      (c->>'contact3_phone1_type')::text,
      (c->>'contact3_phone2_type')::text,
      (c->>'contact3_phone3_type')::text,
      (c->>'contact3_email1')::text,
      (c->>'contact3_email2')::text,
      (c->>'contact3_email3')::text,
      (c->>'batch_id')::uuid,
      (c->>'batch_name')::text,
      (c->>'dnc_toggle')::boolean,
      (c->>'litigator')::boolean,
      (c->>'overall_status')::text,
      (c->>'distress_score')::integer,
      (c->>'score_tier')::text,
      (c->>'distress_flags')::text,
      (c->>'deal_automator_url')::text,
      (c->>'source')::text,
      (c->>'created_by')::text,
      (c->>'pushed_to_ghl')::boolean,
      COALESCE((c->>'tags')::jsonb, '[]'::jsonb),
      (c->>'beds')::integer,
      (c->>'baths')::numeric,
      (c->>'sqft')::integer,
      (c->>'year_built')::integer,
      (c->>'lot_size')::integer,
      (c->>'avm')::numeric,
      (c->>'market_value')::numeric,
      (c->>'wholesale_value')::numeric,
      (c->>'rental_estimate_low')::numeric,
      (c->>'rental_estimate_high')::numeric,
      (c->>'loan_amount')::numeric,
      (c->>'loan_type')::text,
      (c->>'estimated_mortgage_balance')::numeric,
      (c->>'estimated_mortgage_payment')::numeric,
      (c->>'tax_amount')::numeric,
      (c->>'owner_type')::text,
      (c->>'absentee_owner')::boolean,
      (c->>'foreclosure_activity')::boolean,
      (c->>'delinquent_tax')::boolean,
      (c->>'high_equity')::boolean,
      (c->>'free_and_clear')::boolean,
      (c->>'upside_down')::boolean,
      (c->>'long_term_owner')::boolean,
      (c->>'potentially_inherited')::boolean,
      (c->>'active_listing')::boolean,
      (c->>'retail_sellability_score')::integer,
      (c->>'rental_sellability_score')::integer,
      (c->>'wholesale_sellability_score')::integer,
      (c->>'address_hash')::text
    FROM jsonb_array_elements(contacts_data) AS c
    WHERE NOT EXISTS (
      SELECT 1 FROM contacts existing
      WHERE existing.property_address = (c->>'property_address')::text
        AND existing.property_city = (c->>'property_city')::text
        AND (c->>'property_address')::text IS NOT NULL
        AND (c->>'property_city')::text IS NOT NULL
    )
    RETURNING id
  )
  SELECT jsonb_agg(id) INTO inserted_ids FROM inserted;
  
  RETURN COALESCE(inserted_ids, '[]'::jsonb);
END;
$$;

-- ==========================================
-- FILE: 20260228040000_add_contacts_jsonb.sql
-- ==========================================

-- Migration to add a parsed JSONB array for Contacts & Phones to store DNC status per phone properly
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;

-- Optional: Comments for table structure indexing down the line
COMMENT ON COLUMN contacts.contacts IS 'Contains [{ "name": string, "phone": string, "email": string, "type": string, "dnc": boolean }] representations of Landlord 1/2/3 and additional contact columns imported dynamically.';


-- ==========================================
-- FILE: 20260228050000_fix_contacts_jsonb_naming.sql
-- ==========================================

-- Migration to fix contact JSONB naming mismatch and add missing helper columns
-- Renames 'contacts' to 'contacts_json' and adds 'dnc_flags' and 'non_dnc_count'

-- 1. Rename existing column if it exists with the old name
DO $$ 
BEGIN
  IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'contacts'
    ) AND NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'contacts_json'
    ) THEN
      ALTER TABLE contacts RENAME COLUMN contacts TO contacts_json;
  END IF;
END $$;

-- 2. Add missing columns
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS dnc_flags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS non_dnc_count INTEGER DEFAULT 0;

-- 3. Update comments
COMMENT ON COLUMN contacts.contacts_json IS 'Contains [{ "name": string, "type": string, "phones": [{ "number": string, "phoneType": string, "dnc": boolean }], "emails": string[], "dnc": boolean }] representations of contacts.';
COMMENT ON COLUMN contacts.dnc_flags IS 'Array of { phone: string, dnc: boolean } for efficient indexing and querying.';
COMMENT ON COLUMN contacts.non_dnc_count IS 'Cached count of non-DNC (callable) phones for this contact row.';

-- 4. Update the bulk_upsert_contacts function to handle the new columns correctly
CREATE OR REPLACE FUNCTION bulk_upsert_contacts(contacts_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_ids jsonb := '[]'::jsonb;
BEGIN
  WITH inserted AS (
    INSERT INTO contacts (
      first_name, last_name, property_name, lead_type,
      property_address, property_city, property_state, property_zip,
      mailing_address, mailing_city, mailing_state, mailing_zip,
      contact1_name, contact1_type, contact1_phone1, contact1_phone2, contact1_phone3,
      contact1_phone1_type, contact1_phone2_type, contact1_phone3_type,
      contact1_email1, contact1_email2, contact1_email3,
      contact2_name, contact2_type, contact2_phone1, contact2_phone2, contact2_phone3,
      contact2_phone1_type, contact2_phone2_type, contact2_phone3_type,
      contact2_email1, contact2_email2, contact2_email3,
      contact3_name, contact3_type, contact3_phone1, contact3_phone2, contact3_phone3,
      contact3_phone1_type, contact3_phone2_type, contact3_phone3_type,
      contact3_email1, contact3_email2, contact3_email3,
      batch_id, batch_name, dnc_toggle, litigator, overall_status,
      distress_score, score_tier, distress_flags, deal_automator_url,
      source, created_by, pushed_to_ghl, tags,
      beds, baths, sqft, year_built, lot_size, avm, market_value,
      wholesale_value, rental_estimate_low, rental_estimate_high,
      loan_amount, loan_type, estimated_mortgage_balance, estimated_mortgage_payment,
      tax_amount, owner_type, absentee_owner, foreclosure_activity,
      delinquent_tax, high_equity, free_and_clear, upside_down,
      long_term_owner, potentially_inherited, active_listing,
      retail_sellability_score, rental_sellability_score, wholesale_sellability_score,
      address_hash,
      -- New Columns
      contacts_json, dnc_flags, non_dnc_count
    )
    SELECT
      (c->>'first_name')::text,
      (c->>'last_name')::text,
      (c->>'property_name')::text,
      (c->>'lead_type')::text,
      (c->>'property_address')::text,
      (c->>'property_city')::text,
      (c->>'property_state')::text,
      (c->>'property_zip')::text,
      (c->>'mailing_address')::text,
      (c->>'mailing_city')::text,
      (c->>'mailing_state')::text,
      (c->>'mailing_zip')::text,
      (c->>'contact1_name')::text,
      (c->>'contact1_type')::text,
      (c->>'contact1_phone1')::text,
      (c->>'contact1_phone2')::text,
      (c->>'contact1_phone3')::text,
      (c->>'contact1_phone1_type')::text,
      (c->>'contact1_phone2_type')::text,
      (c->>'contact1_phone3_type')::text,
      (c->>'contact1_email1')::text,
      (c->>'contact1_email2')::text,
      (c->>'contact1_email3')::text,
      (c->>'contact2_name')::text,
      (c->>'contact2_type')::text,
      (c->>'contact2_phone1')::text,
      (c->>'contact2_phone2')::text,
      (c->>'contact2_phone3')::text,
      (c->>'contact2_phone1_type')::text,
      (c->>'contact2_phone2_type')::text,
      (c->>'contact2_phone3_type')::text,
      (c->>'contact2_email1')::text,
      (c->>'contact2_email2')::text,
      (c->>'contact2_email3')::text,
      (c->>'contact3_name')::text,
      (c->>'contact3_type')::text,
      (c->>'contact3_phone1')::text,
      (c->>'contact3_phone2')::text,
      (c->>'contact3_phone3')::text,
      (c->>'contact3_phone1_type')::text,
      (c->>'contact3_phone2_type')::text,
      (c->>'contact3_phone3_type')::text,
      (c->>'contact3_email1')::text,
      (c->>'contact3_email2')::text,
      (c->>'contact3_email3')::text,
      (c->>'batch_id')::uuid,
      (c->>'batch_name')::text,
      (c->>'dnc_toggle')::boolean,
      (c->>'litigator')::boolean,
      (c->>'overall_status')::text,
      (c->>'distress_score')::integer,
      (c->>'score_tier')::text,
      (c->>'distress_flags')::text,
      (c->>'deal_automator_url')::text,
      (c->>'source')::text,
      (c->>'created_by')::text,
      (c->>'pushed_to_ghl')::boolean,
      COALESCE((c->>'tags')::jsonb, '[]'::jsonb),
      (c->>'beds')::integer,
      (c->>'baths')::numeric,
      (c->>'sqft')::integer,
      (c->>'year_built')::integer,
      (c->>'lot_size')::integer,
      (c->>'avm')::numeric,
      (c->>'market_value')::numeric,
      (c->>'wholesale_value')::numeric,
      (c->>'rental_estimate_low')::numeric,
      (c->>'rental_estimate_high')::numeric,
      (c->>'loan_amount')::numeric,
      (c->>'loan_type')::text,
      (c->>'estimated_mortgage_balance')::numeric,
      (c->>'estimated_mortgage_payment')::numeric,
      (c->>'tax_amount')::numeric,
      (c->>'owner_type')::text,
      (c->>'absentee_owner')::boolean,
      (c->>'foreclosure_activity')::boolean,
      (c->>'delinquent_tax')::boolean,
      (c->>'high_equity')::boolean,
      (c->>'free_and_clear')::boolean,
      (c->>'upside_down')::boolean,
      (c->>'long_term_owner')::boolean,
      (c->>'potentially_inherited')::boolean,
      (c->>'active_listing')::boolean,
      (c->>'retail_sellability_score')::integer,
      (c->>'rental_sellability_score')::integer,
      (c->>'wholesale_sellability_score')::integer,
      (c->>'address_hash')::text,
      -- New column mappings
      COALESCE((c->'contacts_json')::jsonb, '[]'::jsonb),
      COALESCE((c->'dnc_flags')::jsonb, '[]'::jsonb),
      COALESCE((c->>'non_dnc_count')::integer, 0)
    FROM jsonb_array_elements(contacts_data) AS c
    ON CONFLICT (property_address, property_city) 
    WHERE property_address IS NOT NULL AND property_city IS NOT NULL
    DO UPDATE SET
      contacts_json = EXCLUDED.contacts_json,
      dnc_flags = EXCLUDED.dnc_flags,
      non_dnc_count = EXCLUDED.non_dnc_count,
      updated_at = now()
    RETURNING id
  )
  SELECT jsonb_agg(id) INTO inserted_ids FROM inserted;
  
  RETURN COALESCE(inserted_ids, '[]'::jsonb);
END;
$$;


-- ==========================================
-- FILE: 20260312000000_add_missing_contacts_columns.sql
-- ==========================================

-- Migration: Add missing columns that are required by the application
-- Fixes: PGRST204 error "Could not find the 'contacts_json' column of 'contacts' in the schema cache"

-- 1. Rename existing 'contacts' column to 'contacts_json' if it exists with the old name
DO $$ 
BEGIN
  IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'contacts'
    ) AND NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'contacts_json'
    ) THEN
      ALTER TABLE contacts RENAME COLUMN contacts TO contacts_json;
  END IF;
END $$;

-- 2. Add contacts_json JSONB column
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS contacts_json JSONB DEFAULT '[]'::jsonb;

-- 3. Add dnc_flags JSONB column
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS dnc_flags JSONB DEFAULT '[]'::jsonb;

-- 4. Add non_dnc_count integer column
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS non_dnc_count INTEGER DEFAULT 0;

-- 5. Add ghl_sync_status text column
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS ghl_sync_status TEXT;

-- 6. Add lead_type text column
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS lead_type TEXT;

-- 7. Add property_name text column (for commercial leads)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS property_name TEXT;

-- 8. Add owner_type text column
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS owner_type TEXT;

-- 9. Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
