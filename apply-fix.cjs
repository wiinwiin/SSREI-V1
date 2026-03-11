/**
 * Run: node apply-fix.cjs
 * Applies missing columns to the Supabase contacts table.
 * Uses the service role key to execute raw SQL.
 */

// ⚠️ Replace this with your SERVICE ROLE KEY from:
// https://supabase.com/dashboard/project/iozeugdizxzndvedsgtw/settings/api
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const SUPABASE_URL = 'https://iozeugdizxzndvedsgtw.supabase.co';
const PROJECT_REF = 'iozeugdizxzndvedsgtw';

const statements = [
  `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'contacts') THEN ALTER TABLE contacts RENAME COLUMN contacts TO contacts_json; END IF; END $$`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contacts_json JSONB DEFAULT '[]'::jsonb`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dnc_flags JSONB DEFAULT '[]'::jsonb`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS non_dnc_count INTEGER DEFAULT 0`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ghl_sync_status TEXT`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_type TEXT`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS property_name TEXT`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS owner_type TEXT`,
];

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ query: sql })
  });
  return res;
}

async function applyViaManagementAPI() {
  // Use Supabase Management API to run SQL (requires access token, not service role)
  // This approach requires a personal access token from supabase.com/dashboard/account/tokens
  console.log('\n📋 MANUAL APPLICATION REQUIRED\n');
  console.log('Since automated application requires credentials not available here,');
  console.log('please run the following in Supabase SQL Editor:');
  console.log('URL: https://supabase.com/dashboard/project/iozeugdizxzndvedsgtw/sql/new\n');
  console.log('='.repeat(70));
  console.log(statements.map(s => s + ';').join('\n'));
  console.log('\nNOTIFY pgrst, \'reload schema\';');
  console.log('\nSELECT column_name FROM information_schema.columns WHERE table_name = \'contacts\' AND column_name IN (\'contacts_json\', \'dnc_flags\', \'non_dnc_count\') ORDER BY column_name;');
  console.log('='.repeat(70));
}

applyViaManagementAPI();
