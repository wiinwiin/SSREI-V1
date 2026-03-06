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
