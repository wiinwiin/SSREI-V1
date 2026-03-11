import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wcrcjmhgoukgpqqyfoma.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcmNqbWhnb3VrZ3BxcXlmb21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mjk0MzIsImV4cCI6MjA4ODQwNTQzMn0.18YsVRDP548aHdf6jkFWKlsg-LA4g1FDvFEErk8nlTk',
  { db: { schema: 'public' } }
);

async function testRPC() {
  console.log('Testing bulk_upsert_contacts RPC specifically...');
  const fakeData = [{
    first_name: "RPC",
    last_name: "Insert",
    property_address: "456 RPC Way",
    property_city: "RPC Town",
    contacts_json: [],
    dnc_flags: [],
    non_dnc_count: 0
  }];
  
  const rpcTest = await supabase.rpc('bulk_upsert_contacts', { contacts_data: fakeData });
  
  if (rpcTest.error) console.error('RPC Error:', rpcTest.error);
  else {
    console.log('RPC Success! Return Data:', rpcTest.data);
  }
}

testRPC();
