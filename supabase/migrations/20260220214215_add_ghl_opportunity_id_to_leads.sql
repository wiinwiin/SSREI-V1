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
