import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wcrcjmhgoukgpqqyfoma.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcmNqbWhnb3VrZ3BxcXlmb21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mjk0MzIsImV4cCI6MjA4ODQwNTQzMn0.18YsVRDP548aHdf6jkFWKlsg-LA4g1FDvFEErk8nlTk'
);

async function checkRPC() {
  console.log('Testing bulk_upsert_contacts RPC...');
  const fakeData = [{
    first_name: "Test",
    last_name: "User",
    property_address: "123 Main St",
    property_city: "Anytown",
    contacts_json: [],
    dnc_flags: [],
    non_dnc_count: 0
  }];
  
  const { data, error } = await supabase.rpc('bulk_upsert_contacts', { contacts_data: fakeData });
  
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success:', data);
    
    // Cleanup if it succeeded
    if (data && data.length > 0) {
      await supabase.from('contacts').delete().in('id', data);
    }
  }
}

checkRPC();
