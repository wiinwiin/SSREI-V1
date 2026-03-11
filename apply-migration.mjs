/**
 * apply-migration.mjs
 * Applies the missing columns migration to Supabase.
 * Run with: node apply-migration.mjs
 * 
 * NOTE: This requires the SUPABASE_SERVICE_ROLE_KEY environment variable to be set,
 * OR you can paste it directly below (remove from the file after use for security).
 */

import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://iozeugdizxzndvedsgtw.supabase.co';

// Set your service role key here (or via env var SUPABASE_SERVICE_ROLE_KEY)
// You can find it in: Supabase Dashboard > Settings > API > service_role key
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE';

if (SERVICE_ROLE_KEY === 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE') {
  console.error('❌ Please set the SUPABASE_SERVICE_ROLE_KEY environment variable or paste the key in this file.');
  console.error('   Find it at: https://supabase.com/dashboard/project/iozeugdizxzndvedsgtw/settings/api');
  process.exit(1);
}

const sql = `
-- Add missing columns to contacts table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'contacts'
  ) THEN
    ALTER TABLE contacts RENAME COLUMN contacts TO contacts_json;
  END IF;
END $$;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contacts_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dnc_flags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS non_dnc_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ghl_sync_status TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_type TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS property_name TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS owner_type TEXT;

NOTIFY pgrst, 'reload schema';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contacts' 
  AND column_name IN ('contacts_json', 'dnc_flags', 'non_dnc_count', 'ghl_sync_status', 'lead_type', 'property_name', 'owner_type')
ORDER BY column_name;
`;

async function applyMigration() {
  console.log('🔧 Applying migration to Supabase...');
  console.log(`   Project: ${SUPABASE_URL}`);
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  // The above won't work through REST - we need to use the management API
  // Let's try via the postgres connection instead
  console.log('ℹ️  Direct REST SQL execution requires the Supabase Management API.');
  console.log('');
  console.log('📋 MANUAL STEPS TO FIX THE DATABASE:');
  console.log('');
  console.log('1. Go to: https://supabase.com/dashboard/project/iozeugdizxzndvedsgtw/sql/new');
  console.log('2. Copy and paste the following SQL, then click "Run":');
  console.log('');
  console.log('----------------------------------------');
  console.log(sql);
  console.log('----------------------------------------');
  console.log('');
  console.log('3. After running, you should see the columns listed in the results.');
  console.log('4. Then retry the CSV import in the application.');
}

applyMigration().catch(console.error);
