import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wcrcjmhgoukgpqqyfoma.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcmNqbWhnb3VrZ3BxcXlmb21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mjk0MzIsImV4cCI6MjA4ODQwNTQzMn0.18YsVRDP548aHdf6jkFWKlsg-LA4g1FDvFEErk8nlTk',
  { db: { schema: 'public' } }
);

async function forceCacheRefresh() {
  console.log('Fetching table info to trigger schema cache reload...');
  try {
    // A simple RPC call or a query on a core table sometimes refreshes it
    const { error: e1 } = await supabase.from('leads').select('id').limit(1);
    console.log('Leads check:', e1 ? e1.message : 'OK');
    
    const { error: e2 } = await supabase.from('contacts').select('id').limit(1);
    console.log('Contacts check:', e2 ? e2.message : 'OK');
    
    if (e2 && e2.message.includes('schema cache')) {
      console.log('\n❌ Supabase Data API cache is stuck. The user needs to trigger a reload in the dashboard.');
    } else {
      console.log('\n✅ Data API should be good to go now.');
    }
  } catch (e) {
    console.error(e);
  }
}

forceCacheRefresh();
