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
