import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wcrcjmhgoukgpqqyfoma.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcmNqbWhnb3VrZ3BxcXlmb21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mjk0MzIsImV4cCI6MjA4ODQwNTQzMn0.18YsVRDP548aHdf6jkFWKlsg-LA4g1FDvFEErk8nlTk'
);

// Often the 'information_schema' is not exposed via REST. 
// Let's just try to test the actual application tables
const checkList = ['leads', 'settings', 'import_batches', 'contacts', 'buyers', 'saved_filters', 'notifications', 'app_settings', 'user_profiles'];

async function checkAppTables() {
  console.log('Checking application tables individually...\n');
  for (const table of checkList) {
    const { error } = await supabase.from(table).select('id').limit(1);
    
    if (error) {
       console.log(`❌ ${table}: MISSING OR ERROR (${error.message})`);
    } else {
       console.log(`✅ ${table}: EXISTS`);
    }
  }
}

checkAppTables();
