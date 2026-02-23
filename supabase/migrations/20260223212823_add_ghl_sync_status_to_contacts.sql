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
