import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wcrcjmhgoukgpqqyfoma.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcmNqbWhnb3VrZ3BxcXlmb21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mjk0MzIsImV4cCI6MjA4ODQwNTQzMn0.18YsVRDP548aHdf6jkFWKlsg-LA4g1FDvFEErk8nlTk'
);

async function testImportFlow() {
  console.log('1. Testing raw table insert...');
  const insertTest = await supabase.from('contacts').insert({
    first_name: 'Direct',
    last_name: 'Insert',
    property_address: '123 Test Ave',
    property_city: 'Testville',
    contacts_json: [],
    dnc_flags: [],
    non_dnc_count: 0
  }).select();
  
  if (insertTest.error) console.error('Raw Insert Error:', insertTest.error);
  else {
    console.log('Raw Insert Success! ID:', insertTest.data[0].id);
    await supabase.from('contacts').delete().eq('id', insertTest.data[0].id);
  }

  console.log('\n2. Testing RPC bulk insert...');
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
    if (rpcTest.data && rpcTest.data.length > 0) {
      await supabase.from('contacts').delete().in('id', rpcTest.data);
    }
  }
}

testImportFlow();
