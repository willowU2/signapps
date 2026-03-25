const fs = require('fs');
const path = require('path');

const builderPath = path.join('client', 'src', 'app', 'forms', '[id]', 'page.tsx');
let builderCode = fs.readFileSync(builderPath, 'utf8');

const replacements = [
    { from: /field_type: 'text'/g, to: "field_type: 'Text'" },
    { from: /field_type: 'textarea'/g, to: "field_type: 'TextArea'" },
    { from: /field_type: 'select'/g, to: "field_type: 'SingleChoice'" },
    { from: /field_type: 'checkbox'/g, to: "field_type: 'MultipleChoice'" },
    { from: /field_type: 'date'/g, to: "field_type: 'Date'" },
    { from: /field_type: 'email'/g, to: "field_type: 'Email'" },
    { from: /field_type: 'number'/g, to: "field_type: 'Number'" },

    { from: /field_type === 'text'/g, to: "field_type === 'Text'" },
    { from: /field_type === 'textarea'/g, to: "field_type === 'TextArea'" },
    { from: /field_type === 'select'/g, to: "field_type === 'SingleChoice'" },
    { from: /field_type === 'checkbox'/g, to: "field_type === 'MultipleChoice'" },
    { from: /field_type === 'date'/g, to: "field_type === 'Date'" },
    { from: /field_type === 'email'/g, to: "field_type === 'Email'" },
    { from: /field_type === 'number'/g, to: "field_type === 'Number'" },
];

replacements.forEach(r => builderCode = builderCode.replace(r.from, r.to));
fs.writeFileSync(builderPath, builderCode);

const publicPath = path.join('client', 'src', 'app', 'f', '[id]', 'page.tsx');
let publicCode = fs.readFileSync(publicPath, 'utf8');

const publicReplacements = [
    { from: /field_type === 'text'/g, to: "field_type === 'Text'" },
    { from: /field_type === 'textarea'/g, to: "field_type === 'TextArea'" },
    { from: /field_type === 'select'/g, to: "field_type === 'SingleChoice'" },
    { from: /field_type === 'checkbox'/g, to: "field_type === 'MultipleChoice'" },
    { from: /field_type === 'date'/g, to: "field_type === 'Date'" },
    { from: /field_type === 'email'/g, to: "field_type === 'Email'" },
    { from: /field_type === 'number'/g, to: "field_type === 'Number'" },
    { from: /type=\{field\.field_type\}/g, to: "type={field.field_type.toLowerCase()}" },
];

publicReplacements.forEach(r => publicCode = publicCode.replace(r.from, r.to));
fs.writeFileSync(publicPath, publicCode);

console.log("Types replaced successfully");
