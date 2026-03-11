import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wcrcjmhgoukgpqqyfoma.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcmNqbWhnb3VrZ3BxcXlmb21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mjk0MzIsImV4cCI6MjA4ODQwNTQzMn0.18YsVRDP548aHdf6jkFWKlsg-LA4g1FDvFEErk8nlTk',
  { db: { schema: 'public' } }
);

async function inspectSchema() {
  console.log('Inspecting raw schema layout...');
  // Since we can't query information_schema easily via standard client if restricted, 
  // Let's use the REST API explicitly specifying endpoints if possible
  
  // Actually, we CAN query information_schema.tables directly if we don't use 'public' default
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_schema, table_name')
    .ilike('table_name', '%contact%');
    
  if (error) {
    console.error('Info Schema restricted:', error.message);
  } else {
    console.log('Found tables matching "contact":', data);
  }
}

inspectSchema();
