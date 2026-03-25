const fs = require('fs');
const file = 'client/src/app/tools/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. remove import
txt = txt.replace(/import \{[\s\S]*?\} from '@\/lib\/api\/office';/, "import {\n  getPresentationInfo,\n  type ExportFormat,\n} from '@/lib/api/office';");

// 2. remove converter tab function
const idx1 = txt.indexOf('// ─── Tab: Converter ──');
const idx2 = txt.indexOf('// ─── Tab: Spreadsheets ──');
if (idx1 > -1 && idx2 > -1) {
  txt = txt.slice(0, idx1) + txt.slice(idx2);
}

// 3. Rename page & setup tabs
txt = txt.replace(/export default function OfficePage\(\) \{[\s\S]*?<\/TabsList>/, `export default function ToolsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Tools</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Spreadsheet import/export, PDF utilities, and presentation export
            </p>
          </div>
          <Badge variant="outline" className="hidden sm:flex items-center gap-1.5">
            <FileText className="h-3 w-3" /> signapps-tools
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="spreadsheets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="spreadsheets" className="flex items-center gap-1.5">
              <Table2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Spreadsheets</span>
            </TabsTrigger>
            <TabsTrigger value="pdf" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PDF Tools</span>
            </TabsTrigger>
            <TabsTrigger value="presentations" className="flex items-center gap-1.5">
              <Presentation className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Presentations</span>
            </TabsTrigger>
          </TabsList>`);

// 4. remove TabsContent
txt = txt.replace(/<TabsContent value="converter">[\s\S]*?<\/TabsContent>/, '');

fs.writeFileSync(file, txt);
console.log("ok");
