const fs = require('fs');

try {
  let sql = fs.readFileSync('master_schema_setup_v2.sql', 'utf8');

  // Fix Policies
  // Match `CREATE POLICY "name" <anything until ON> ON table_name`
  sql = sql.replace(/CREATE POLICY "([^"]+)"([\s\S]*?)ON\s+([a-zA-Z0-9_\.]+)/g, 'DROP POLICY IF EXISTS "$1" ON $3;\nCREATE POLICY "$1"$2ON $3');

  // Fix Triggers
  // Match `CREATE TRIGGER name <anything until ON> ON table_name`
  sql = sql.replace(/CREATE TRIGGER\s+([a-zA-Z0-9_]+)([\s\S]*?)ON\s+([a-zA-Z0-9_\.]+)/g, 'DROP TRIGGER IF EXISTS $1 ON $3;\nCREATE TRIGGER $1$2ON $3');
  
  // Also fix `CREATE OR REPLACE FUNCTION` if needed (already idempotent but good to know)
  
  fs.writeFileSync('master_schema_setup_v3.sql', sql);
  console.log('Successfully created master_schema_setup_v3.sql');
} catch (e) {
  console.error(e);
}
