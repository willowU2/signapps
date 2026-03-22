const fs = require('fs');
const file = 'c:/Users/etien/OneDrive/Bureau/signapps/client/src/app/storage/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// The closing tag was already replaced in the previous step, so we just need to replace the opening tag
content = content.replace(/<DropZone[\s\S]*?className="flex-1 min-h-\[400px\]"[\s\S]*?>/, 
`<div className="flex-1 min-h-[400px] flex flex-col gap-4">
  <FileUploadProgressBar
    bucket={currentBucket}
    prefix={currentPath.length > 0 ? currentPath.join('/') : undefined}
    onUploadComplete={fetchFiles}
  />`);

fs.writeFileSync(file, content, 'utf8');
console.log('Replaced successfully');
