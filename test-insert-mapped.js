import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wcrcjmhgoukgpqqyfoma.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcmNqbWhnb3VrZ3BxcXlmb21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mjk0MzIsImV4cCI6MjA4ODQwNTQzMn0.18YsVRDP548aHdf6jkFWKlsg-LA4g1FDvFEErk8nlTk'
);

async function testFullInsert() {
  const contactToSave = {
    first_name: "Test",
    last_name: "User",
    property_address: "123 Main St",
    property_city: "Anytown",
    contacts_json: [],
    dnc_flags: [],
    non_dnc_count: 0,
    batch_id: null,
    batch_name: "Test Batch",
    dnc_toggle: false,
    litigator: false,
    overall_status: "Clean",
    distress_score: 50,
    score_tier: "Hot",
    distress_flags: "High Equity",
    deal_automator_url: "",
    source: "CSV Import",
    created_by: "Unknown",
    pushed_to_ghl: false,
    tags: []
  };

  const { data, error } = await supabase.from('contacts').insert([contactToSave]);
  if (error) {
    console.error("Insert failed:\n", JSON.stringify(error, null, 2));
  } else {
    console.log("Insert succeeded!", data);
  }
}

testFullInsert();
