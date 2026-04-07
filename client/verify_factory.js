const fs = require("fs");
const code = fs.readFileSync("src/lib/api/factory.ts", "utf8");
const match = code.match(/case ServiceName\.IDENTITY:\s*envValue\s*=\s*(.*?);/);
console.log("Code for IDENTITY in factory:", match ? match[1] : "not found");
