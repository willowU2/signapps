'use client';

import { useState, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText,
  Table2,
  FileType,
  Presentation,
  Upload,
  Download,
  Scissors,
  Merge,
  AlignLeft,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
  File,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  importFromFile,
  exportDocument,
  getPresentationInfo,
  type ExportFormat,
  type ImportResult,
} from '@/lib/api/office';
import { getServiceBaseUrl, ServiceName } from '@/lib/api/factory';

// ─── Helpers ────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function officePost(path: string, body: FormData | object, asBlob = false): Promise<any> {
  const baseUrl = getServiceBaseUrl(ServiceName.OFFICE);
  const isFormData = body instanceof FormData;
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return asBlob ? res.blob() : res.json();
}

// ─── Shared FileDropZone ─────────────────────────────────────────────────────

interface FileDropZoneProps {
  onFile: (file: File) => void;
  accept?: string;
  label?: string;
  file?: File | null;
  onClear?: () => void;
}

function FileDropZone({ onFile, accept, label = 'Drag & drop or click to select', file, onClear }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer
        ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {file ? (
        <div className="flex items-center gap-2 text-sm">
          <File className="h-4 w-4 text-primary" />
          <span className="font-medium truncate max-w-[200px]">{file.name}</span>
          <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
          {onClear && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="ml-1 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">{label}</p>
        </>
      )}
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'idle' | 'loading' | 'success' | 'error' }) {
  if (status === 'loading') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
  return null;
}

// ─── Tab: Converter ──────────────────────────────────────────────────────────

function ConverterTab() {
  const [file, setFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<ExportFormat>('pdf');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleConvert = async () => {
    if (!file) return;
    setStatus('loading');
    setImportResult(null);
    try {
      // Step 1: import file → Tiptap JSON
      const imported = await importFromFile(file);
      setImportResult(imported);

      // Step 2: export Tiptap JSON → desired format
      const blob = await exportDocument(imported.tiptap_json, outputFormat, {
        filename: file.name.replace(/\.[^.]+$/, ''),
      });

      const ext = outputFormat === 'markdown' ? 'md' : outputFormat;
      triggerDownload(blob, `${file.name.replace(/\.[^.]+$/, '')}.${ext}`);
      setStatus('success');
      toast.success(`Converted to ${outputFormat.toUpperCase()} successfully`);
    } catch (err: any) {
      setStatus('error');
      toast.error(`Conversion failed: ${err.message}`);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Source File
          </CardTitle>
          <CardDescription>Upload a DOCX, Markdown, HTML, or TXT file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone
            onFile={setFile}
            accept=".docx,.md,.markdown,.html,.txt"
            label="Drop DOCX, MD, HTML, or TXT here"
            file={file}
            onClear={() => { setFile(null); setStatus('idle'); setImportResult(null); }}
          />
          {importResult && (
            <div className="text-xs text-muted-foreground space-y-1 rounded-lg bg-muted/50 p-3">
              <p><span className="font-medium">Detected:</span> {importResult.detected_format}</p>
              <p><span className="font-medium">Words:</span> {importResult.metadata.word_count.toLocaleString()}</p>
              <p><span className="font-medium">Characters:</span> {importResult.metadata.character_count.toLocaleString()}</p>
              {importResult.metadata.has_tables && <Badge variant="outline" className="text-xs">Tables</Badge>}
              {importResult.metadata.has_images && <Badge variant="outline" className="text-xs ml-1">Images</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Output Format
          </CardTitle>
          <CardDescription>Select the target format and convert</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Convert to</Label>
            <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as ExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">DOCX</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="text">Plain Text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            disabled={!file || status === 'loading'}
            onClick={handleConvert}
          >
            {status === 'loading' ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Converting…</>
            ) : (
              <><FileType className="mr-2 h-4 w-4" /> Convert &amp; Download</>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 h-6">
            <StatusBadge status={status} />
            {status === 'success' && <span className="text-xs text-green-600">Download started</span>}
            {status === 'error' && <span className="text-xs text-destructive">Conversion failed</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Spreadsheets ────────────────────────────────────────────────────────

function SpreadsheetsTab() {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importedData, setImportedData] = useState<any | null>(null);

  const [exportData, setExportData] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'ods'>('csv');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleImport = async () => {
    if (!importFile) return;
    setImportStatus('loading');
    setImportedData(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const result = await officePost('/spreadsheet/import', formData);
      setImportedData(result);
      setImportStatus('success');
      toast.success('Spreadsheet imported successfully');
    } catch (err: any) {
      setImportStatus('error');
      toast.error(`Import failed: ${err.message}`);
    }
  };

  const handleExport = async () => {
    if (!exportData.trim()) return;
    setExportStatus('loading');
    try {
      const blob = await officePost(
        `/spreadsheet/export?format=${exportFormat}`,
        { data: exportData, format: exportFormat },
        true
      );
      triggerDownload(blob as Blob, `export.${exportFormat}`);
      setExportStatus('success');
      toast.success(`Exported as ${exportFormat.toUpperCase()}`);
    } catch (err: any) {
      setExportStatus('error');
      toast.error(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import Spreadsheet
          </CardTitle>
          <CardDescription>Upload a CSV or ODS file to parse its data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone
            onFile={setImportFile}
            accept=".csv,.ods"
            label="Drop CSV or ODS file here"
            file={importFile}
            onClear={() => { setImportFile(null); setImportStatus('idle'); setImportedData(null); }}
          />
          <Button className="w-full" disabled={!importFile || importStatus === 'loading'} onClick={handleImport}>
            {importStatus === 'loading' ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</>
            ) : (
              <><Table2 className="mr-2 h-4 w-4" /> Import</>
            )}
          </Button>
          {importedData && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Import result</p>
              <pre className="overflow-auto max-h-40 text-[11px]">{JSON.stringify(importedData, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Export Spreadsheet
          </CardTitle>
          <CardDescription>Paste CSV data and download as CSV or ODS</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>CSV Data</Label>
            <textarea
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={'name,value\nFoo,42\nBar,99'}
              value={exportData}
              onChange={(e) => setExportData(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'csv' | 'ods')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="ods">ODS (OpenDocument)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled={!exportData.trim() || exportStatus === 'loading'} onClick={handleExport}>
            {exportStatus === 'loading' ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting…</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Export &amp; Download</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: PDF Tools ────────────────────────────────────────────────────────────

function PdfToolsTab() {
  const [extractFile, setExtractFile] = useState<File | null>(null);
  const [extractStatus, setExtractStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [extractedText, setExtractedText] = useState('');

  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [mergeStatus, setMergeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitPages, setSplitPages] = useState('1-3,4-6');
  const [splitStatus, setSplitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [infoFile, setInfoFile] = useState<File | null>(null);
  const [infoStatus, setInfoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pageInfo, setPageInfo] = useState<any | null>(null);

  const mergeInputRef = useRef<HTMLInputElement>(null);

  const handleExtract = async () => {
    if (!extractFile) return;
    setExtractStatus('loading');
    setExtractedText('');
    try {
      const formData = new FormData();
      formData.append('file', extractFile);
      const result = await officePost('/pdf/extract-text', formData);
      setExtractedText(result.text ?? JSON.stringify(result));
      setExtractStatus('success');
      toast.success('Text extracted');
    } catch (err: any) {
      setExtractStatus('error');
      toast.error(`Extract failed: ${err.message}`);
    }
  };

  const handleMergeAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setMergeFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const handleMerge = async () => {
    if (mergeFiles.length < 2) return;
    setMergeStatus('loading');
    try {
      const formData = new FormData();
      mergeFiles.forEach((f) => formData.append('files', f));
      const blob = await officePost('/pdf/merge', formData, true);
      triggerDownload(blob as Blob, 'merged.pdf');
      setMergeStatus('success');
      toast.success('PDFs merged and downloaded');
    } catch (err: any) {
      setMergeStatus('error');
      toast.error(`Merge failed: ${err.message}`);
    }
  };

  const handleSplit = async () => {
    if (!splitFile) return;
    setSplitStatus('loading');
    try {
      const formData = new FormData();
      formData.append('file', splitFile);
      formData.append('ranges', splitPages);
      const blob = await officePost('/pdf/split', formData, true);
      triggerDownload(blob as Blob, 'split.zip');
      setSplitStatus('success');
      toast.success('PDF split — ZIP downloaded');
    } catch (err: any) {
      setSplitStatus('error');
      toast.error(`Split failed: ${err.message}`);
    }
  };

  const handleInfo = async () => {
    if (!infoFile) return;
    setInfoStatus('loading');
    setPageInfo(null);
    try {
      const formData = new FormData();
      formData.append('file', infoFile);
      const result = await officePost('/pdf/info', formData);
      setPageInfo(result);
      setInfoStatus('success');
      toast.success('Page info retrieved');
    } catch (err: any) {
      setInfoStatus('error');
      toast.error(`Info failed: ${err.message}`);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Extract Text */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlignLeft className="h-4 w-4" /> Extract Text
          </CardTitle>
          <CardDescription>Extract all text content from a PDF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone
            onFile={setExtractFile}
            accept=".pdf"
            label="Drop a PDF here"
            file={extractFile}
            onClear={() => { setExtractFile(null); setExtractStatus('idle'); setExtractedText(''); }}
          />
          <Button className="w-full" disabled={!extractFile || extractStatus === 'loading'} onClick={handleExtract}>
            {extractStatus === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlignLeft className="mr-2 h-4 w-4" />}
            Extract Text
          </Button>
          {extractedText && (
            <textarea
              readOnly
              className="w-full min-h-[100px] rounded-md border border-input bg-muted/50 px-3 py-2 text-xs resize-y"
              value={extractedText}
            />
          )}
        </CardContent>
      </Card>

      {/* Merge PDFs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Merge className="h-4 w-4" /> Merge PDFs
          </CardTitle>
          <CardDescription>Combine multiple PDFs into one file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input ref={mergeInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleMergeAdd} />
          <Button variant="outline" className="w-full" onClick={() => mergeInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Add PDFs
          </Button>
          {mergeFiles.length > 0 && (
            <ul className="space-y-1">
              {mergeFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-sm rounded px-2 py-1 bg-muted/50">
                  <span className="truncate max-w-[180px]">{f.name}</span>
                  <button onClick={() => setMergeFiles((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            className="w-full"
            disabled={mergeFiles.length < 2 || mergeStatus === 'loading'}
            onClick={handleMerge}
          >
            {mergeStatus === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Merge className="mr-2 h-4 w-4" />}
            Merge {mergeFiles.length > 0 && `(${mergeFiles.length} files)`}
          </Button>
        </CardContent>
      </Card>

      {/* Split PDF */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scissors className="h-4 w-4" /> Split PDF
          </CardTitle>
          <CardDescription>Split a PDF into parts by page ranges</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone
            onFile={setSplitFile}
            accept=".pdf"
            label="Drop a PDF here"
            file={splitFile}
            onClear={() => { setSplitFile(null); setSplitStatus('idle'); }}
          />
          <div className="space-y-2">
            <Label>Page Ranges</Label>
            <Input
              value={splitPages}
              onChange={(e) => setSplitPages(e.target.value)}
              placeholder="e.g. 1-3,4-6,7"
            />
            <p className="text-xs text-muted-foreground">Comma-separated ranges. Result is a ZIP archive.</p>
          </div>
          <Button className="w-full" disabled={!splitFile || splitStatus === 'loading'} onClick={handleSplit}>
            {splitStatus === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scissors className="mr-2 h-4 w-4" />}
            Split &amp; Download ZIP
          </Button>
        </CardContent>
      </Card>

      {/* Page Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" /> Page Info
          </CardTitle>
          <CardDescription>Get metadata and page dimensions for a PDF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone
            onFile={setInfoFile}
            accept=".pdf"
            label="Drop a PDF here"
            file={infoFile}
            onClear={() => { setInfoFile(null); setInfoStatus('idle'); setPageInfo(null); }}
          />
          <Button className="w-full" disabled={!infoFile || infoStatus === 'loading'} onClick={handleInfo}>
            {infoStatus === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Info className="mr-2 h-4 w-4" />}
            Get Info
          </Button>
          {pageInfo && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs">
              <pre className="overflow-auto max-h-48 text-[11px]">{JSON.stringify(pageInfo, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Presentations ───────────────────────────────────────────────────────

function PresentationsTab() {
  const [title, setTitle] = useState('My Presentation');
  const [slidesJson, setSlidesJson] = useState('');
  const [format, setFormat] = useState<'pptx' | 'pdf' | 'png' | 'svg'>('pptx');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [serviceInfo, setServiceInfo] = useState<any | null>(null);

  const handleLoadInfo = async () => {
    try {
      const info = await getPresentationInfo();
      setServiceInfo(info);
    } catch {
      toast.error('Could not load presentation service info');
    }
  };

  const buildPayload = () => {
    let slides = [];
    if (slidesJson.trim()) {
      try {
        slides = JSON.parse(slidesJson);
      } catch {
        throw new Error('Invalid JSON in slides field');
      }
    } else {
      // Default single slide
      slides = [
        {
          id: 'slide-1',
          elements: [
            {
              type: 'text',
              x: 100,
              y: 200,
              width: 600,
              height: 100,
              content: title,
              style: { fontSize: 40, bold: true },
            },
          ],
          background: '#ffffff',
        },
      ];
    }
    return { title, slides };
  };

  const handleExport = async () => {
    setStatus('loading');
    try {
      const payload = buildPayload();
      const baseUrl = getServiceBaseUrl(ServiceName.OFFICE);

      let endpoint = '';
      let isBlob = true;
      if (format === 'pptx') endpoint = '/presentation/export/pptx';
      else if (format === 'pdf') endpoint = '/presentation/export/pdf';
      else if (format === 'png') endpoint = '/presentation/export/all/png';
      else if (format === 'svg') { endpoint = '/presentation/export/all/svg'; }

      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const ext = format === 'png' || format === 'svg' ? 'zip' : format;
      const blob = await res.blob();
      triggerDownload(blob, `${title.replace(/\s+/g, '_')}.${ext}`);
      setStatus('success');
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      setStatus('error');
      toast.error(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Presentation className="h-4 w-4" /> Export Presentation
              </CardTitle>
              <CardDescription>
                Define slides as JSON and export to PPTX, PDF, PNG, or SVG
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLoadInfo}>
              <Info className="mr-1.5 h-3.5 w-3.5" /> Service Info
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Presentation Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Presentation" />
            </div>
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pptx">PPTX (PowerPoint)</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="png">PNG (all slides, ZIP)</SelectItem>
                  <SelectItem value="svg">SVG (all slides, ZIP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Slides JSON{' '}
              <span className="text-muted-foreground font-normal">(optional — leave blank for a single default slide)</span>
            </Label>
            <textarea
              className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={`[
  {
    "id": "slide-1",
    "elements": [
      { "type": "text", "x": 100, "y": 200, "width": 600, "height": 100, "content": "Hello World" }
    ],
    "background": "#ffffff"
  }
]`}
              value={slidesJson}
              onChange={(e) => setSlidesJson(e.target.value)}
            />
          </div>

          <Button className="w-full sm:w-auto" disabled={status === 'loading'} onClick={handleExport}>
            {status === 'loading' ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting…</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Export Presentation</>
            )}
          </Button>

          {serviceInfo && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">Service v{serviceInfo.version}</p>
              <p>
                <span className="text-muted-foreground">Formats: </span>
                {serviceInfo.supported_formats?.join(', ')}
              </p>
              <p>
                <span className="text-muted-foreground">Max slides: </span>
                {serviceInfo.max_slides}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OfficePage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Office Tools</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Document conversion, spreadsheet import/export, PDF utilities, and presentation export
            </p>
          </div>
          <Badge variant="outline" className="hidden sm:flex items-center gap-1.5">
            <FileText className="h-3 w-3" /> signapps-office
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="converter" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="converter" className="flex items-center gap-1.5">
              <FileType className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Converter</span>
            </TabsTrigger>
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
          </TabsList>

          <TabsContent value="converter">
            <ConverterTab />
          </TabsContent>

          <TabsContent value="spreadsheets">
            <SpreadsheetsTab />
          </TabsContent>

          <TabsContent value="pdf">
            <PdfToolsTab />
          </TabsContent>

          <TabsContent value="presentations">
            <PresentationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
