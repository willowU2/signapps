const fs = require('fs');

const fileBase = 'c:/Users/etien/OneDrive/Bureau/signapps/client/src/components/application/file-upload/file-upload-base.tsx';
let contentBase = fs.readFileSync(fileBase, 'utf8');

// Make the dropzone neutral
contentBase = contentBase.replace(/bg-primary(?![_-])/g, 'bg-background');
// Make the list items neutral
contentBase = contentBase.replace(/bg-secondary(?![_-])/g, 'bg-muted');
contentBase = contentBase.replace(/ring-secondary/g, 'ring-border');
contentBase = contentBase.replace(/ring-primary/g, 'ring-ring');
contentBase = contentBase.replace(/text-secondary/g, 'text-foreground');
contentBase = contentBase.replace(/text-tertiary/g, 'text-muted-foreground');

fs.writeFileSync(fileBase, contentBase, 'utf8');

const fileProgress = 'c:/Users/etien/OneDrive/Bureau/signapps/client/src/components/base/progress-indicators/progress-indicators.tsx';
let contentProgress = fs.readFileSync(fileProgress, 'utf8');

// Make the progress bar fill a neutral black/white
contentProgress = contentProgress.replace(/bg-primary/g, 'bg-zinc-800 dark:bg-zinc-200');
contentProgress = contentProgress.replace(/bg-quaternary/g, 'bg-zinc-100 dark:bg-zinc-800');

fs.writeFileSync(fileProgress, contentProgress, 'utf8');

console.log('Colors neutralized');
