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