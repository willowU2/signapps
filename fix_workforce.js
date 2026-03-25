const fs = require('fs');
const filepath = 'client/src/lib/api/workforce.ts';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/'\/org\//g, "'/workforce/org/");
content = content.replace(/`\/org\//g, "`/workforce/org/");

content = content.replace(/'\/functions/g, "'/workforce/functions");
content = content.replace(/`\/functions/g, "`/workforce/functions");

content = content.replace(/'\/employees/g, "'/workforce/employees");
content = content.replace(/`\/employees/g, "`/workforce/employees");

content = content.replace(/'\/coverage/g, "'/workforce/coverage");
content = content.replace(/`\/coverage/g, "`/workforce/coverage");

content = content.replace(/'\/validation/g, "'/workforce/validation");
content = content.replace(/`\/validation/g, "`/workforce/validation");

fs.writeFileSync(filepath, content);
console.log('Workforce API routes updated successfully.');
