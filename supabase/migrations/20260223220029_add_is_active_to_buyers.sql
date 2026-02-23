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
