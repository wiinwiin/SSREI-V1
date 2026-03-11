const fs = require('fs');

try {
  let text = fs.readFileSync('master_schema_setup_v4.sql', 'utf8');
  
  // Fix the specific renaming error by ensuring the target column doesn't exist
  text = text.replace(
    /IF EXISTS \(\s*SELECT 1\s*FROM information_schema\.columns\s*WHERE table_name = 'contacts' AND column_name = 'contacts'\s*\)\s*THEN\s*ALTER TABLE contacts RENAME COLUMN contacts TO contacts_json;/s,
    `IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'contacts'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'contacts_json'
  ) THEN
    ALTER TABLE contacts RENAME COLUMN contacts TO contacts_json;`
  );

  fs.writeFileSync('master_schema_setup_v5.sql', text);
  console.log('Successfully created master_schema_setup_v5.sql');
} catch (e) {
  console.error(e);
}
