const fs = require('fs');

try {
  let text = fs.readFileSync('master_schema_setup_v4.sql', 'utf8');
  
  // Replace the exact RENAME block. There are two of them, so use a global replace on the exact text.
  let findText = `    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'contacts'
    ) THEN
      ALTER TABLE contacts RENAME COLUMN contacts TO contacts_json;
    END IF;`;

  let replaceText = `    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'contacts'
    ) AND NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'contacts_json'
    ) THEN
      ALTER TABLE contacts RENAME COLUMN contacts TO contacts_json;
    END IF;`;

  // We split by \n and use regex because exact replace can fail due to line endings (\r\n vs \n).
  // A safer approach:
  text = text.replace(
    /IF EXISTS \([\s\S]*?WHERE table_name = 'contacts' AND column_name = 'contacts'\s*\)\s*THEN\s*ALTER TABLE contacts RENAME COLUMN contacts TO contacts_json;/g,
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
