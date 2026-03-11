import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wcrcjmhgoukgpqqyfoma.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcmNqbWhnb3VrZ3BxcXlmb21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mjk0MzIsImV4cCI6MjA4ODQwNTQzMn0.18YsVRDP548aHdf6jkFWKlsg-LA4g1FDvFEErk8nlTk'
);

async function checkTables() {
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
    
  if (error) {
    console.error('Error fetching tables:', error);
  } else {
    console.log('--- Public Tables Currently in Database ---');
    console.log(data.map(t => t.table_name).join('\n'));
    console.log('-----------------------------------------');
  }
}

checkTables();
