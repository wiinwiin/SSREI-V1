const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).sort();

console.log('Found migration files:');
files.forEach(f => console.log(' - ' + f));

let masterSql = '';

files.forEach(file => {
  if (file.endsWith('.sql')) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    masterSql += `\n\n-- ==========================================\n`;
    masterSql += `-- FILE: ${file}\n`;
    masterSql += `-- ==========================================\n\n`;
    masterSql += content;
  }
});

fs.writeFileSync('master_schema_setup_v2.sql', masterSql);
console.log('\n✅ Created master_schema_setup_v2.sql successfully.');
