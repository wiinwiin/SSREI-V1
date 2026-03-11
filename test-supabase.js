import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wcrcjmhgoukgpqqyfoma.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcmNqbWhnb3VrZ3BxcXlmb21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mjk0MzIsImV4cCI6MjA4ODQwNTQzMn0.18YsVRDP548aHdf6jkFWKlsg-LA4g1FDvFEErk8nlTk'
);

async function testSupabase() {
  console.log('Testing connection to new Supabase project (wcrcjmhgoukgpqqyfoma)...');
  
  // Try to insert a dummy contact
  const { data, error } = await supabase.from('contacts').insert({
    first_name: 'Test',
    last_name: 'Contact',
    contacts_json: [],
    dnc_flags: [],
    non_dnc_count: 0
  }).select();

  if (error) {
    console.error('ERROR inserting contact:', error);
  } else {
    console.log('SUCCESS inserting contact:', data);
    
    // Clean up
    if (data && data.length > 0) {
      await supabase.from('contacts').delete().eq('id', data[0].id);
      console.log('Cleaned up test contact.');
    }
  }
}

testSupabase();
