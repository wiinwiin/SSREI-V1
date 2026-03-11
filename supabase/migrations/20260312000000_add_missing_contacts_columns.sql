-- Migration: Add missing columns that are required by the application
-- Fixes: PGRST204 error "Could not find the 'contacts_json' column of 'contacts' in the schema cache"

-- 1. Rename existing 'contacts' column to 'contacts_json' if it exists with the old name
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'contacts'
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
