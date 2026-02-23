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
CREATE POLICY "Allow anon select on leads"
  ON leads FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on leads"
  ON leads FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on leads"
  ON leads FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on leads"
  ON leads FOR DELETE
  TO anon
  USING (true);

-- Policies for settings
CREATE POLICY "Allow anon select on settings"
  ON settings FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on settings"
  ON settings FOR INSERT
  TO anon
  WITH CHECK (true);

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

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
