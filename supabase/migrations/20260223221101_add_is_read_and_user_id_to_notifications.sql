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
