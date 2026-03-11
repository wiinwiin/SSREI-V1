const fs = require('fs');

try {
  let sql = fs.readFileSync('master_schema_setup_v2.sql', 'utf8');

  // 1. Make Policies Idempotent
  // Example: CREATE POLICY "Allow anon select on leads" ON leads
  // Becomes: DROP POLICY IF EXISTS "Allow anon select on leads" ON leads; CREATE POLICY "Allow anon select on leads" ON leads
  sql = sql.replace(/CREATE POLICY "([^"]+)"\s+ON\s+([^ \n]+)/g, 'DROP POLICY IF EXISTS "$1" ON $2;\nCREATE POLICY "$1" ON $2');

  // 2. Make Triggers Idempotent
  // Example: CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  // Becomes: DROP TRIGGER IF EXISTS update_leads_updated_at ON leads; CREATE TRIGGER ...
  sql = sql.replace(/CREATE TRIGGER\s+([a-zA-Z0-9_]+)[\s\S]*?ON\s+([a-zA-Z0-9_\.]+)/g, (match, triggerName, tableName) => {
    // If it already has a DROP TRIGGER right before it, don't double it up
    return `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\n${match}`;
  });
  
  // Clean up double drops if they exist
  sql = sql.replace(/(DROP TRIGGER IF EXISTS [^\n]+;\n)+(DROP TRIGGER)/g, '$2');
  sql = sql.replace(/(DROP POLICY IF EXISTS [^\n]+;\n)+(DROP POLICY)/g, '$2');

  fs.writeFileSync('master_schema_setup_v3.sql', sql);
  console.log('Successfully created master_schema_setup_v3.sql');
} catch (e) {
  console.error(e);
}
