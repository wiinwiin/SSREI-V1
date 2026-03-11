const fs = require('fs');

try {
  let text = fs.readFileSync('master_schema_setup_v2.sql', 'utf8');
  let lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    // 1. Policies
    let policyMatch = lines[i].match(/CREATE POLICY "([^"]+)"/);
    if (policyMatch) {
      let policyName = policyMatch[1];
      let tableName = null;
      for (let j = i; j < i + 5 && j < lines.length; j++) {
        let onMatch = lines[j].match(/\bON\s+([a-zA-Z0-9_]+)\b/);
        if (onMatch) {
          tableName = onMatch[1];
          break;
        }
      }
      if (tableName) {
        lines[i] = `DROP POLICY IF EXISTS "${policyName}" ON ${tableName};\n` + lines[i];
      }
    }
    
    // 2. Triggers
    let triggerMatch = lines[i].match(/CREATE TRIGGER\s+([a-zA-Z0-9_]+)/);
    // Ignore function triggers
    if (triggerMatch && !lines[i].includes('update_updated_at_column') && !lines[i].includes('on_auth_user_created')) {
      let triggerName = triggerMatch[1];
       let tableName = null;
      for (let j = i; j < i + 5 && j < lines.length; j++) {
        let onMatch = lines[j].match(/\bON\s+([a-zA-Z0-9_\.]+)\b/);
        if (onMatch) {
          tableName = onMatch[1];
          break;
        }
      }
      if (tableName) {
        lines[i] = `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\n` + lines[i];
      }
    } else if (triggerMatch) {
       // specific hardcodes because regex was annoying
       if (lines[i].includes('update_leads_updated_at')) lines[i] = `DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;\n` + lines[i];
       if (lines[i].includes('update_settings_updated_at')) lines[i] = `DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;\n` + lines[i];
       if (lines[i].includes('on_auth_user_created')) lines[i] = `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;\n` + lines[i];
    }
  }

  fs.writeFileSync('master_schema_setup_v4.sql', lines.join('\n'));
  console.log('Successfully created master_schema_setup_v4.sql');
} catch (e) {
  console.error(e);
}
