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
