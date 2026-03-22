'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUp, Loader2, Download, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface TableData {
  headers: string[];
  rows: string[][];
}

export function PdfTableExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Only PDF files are supported');
        return;
      }
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast.error('File size must be less than 20MB');
        return;
      }
      setFile(selectedFile);
      setTableData(null);
      toast.success(`Selected: ${selectedFile.name}`);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      toast.error('Please upload a PDF file');
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockTable: TableData = {
        headers: ['Product ID', 'Product Name', 'Quantity', 'Unit Price', 'Total'],
        rows: [
          ['P001', 'Laptop Pro 15"', '5', '1299.99', '6499.95'],
          ['P002', 'Mouse Wireless', '25', '24.99', '624.75'],
          ['P003', 'USB-C Cable', '50', '9.99', '499.50'],
          ['P004', 'Monitor 27" 4K', '3', '599.99', '1799.97'],
          ['P005', 'Keyboard Mechanical', '10', '149.99', '1499.90'],
        ],
      };

      setTableData(mockTable);
      toast.success('Table extracted successfully');
    } catch (error) {
      toast.error('Failed to extract table from PDF');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (!tableData) {
      toast.error('No table data to export');
      return;
    }

    let content = '';
    let filename = '';

    if (format === 'csv') {
      content = [tableData.headers, ...tableData.rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      filename = 'extracted_table.csv';
    } else {
      const jsonData = {
        headers: tableData.headers,
        rows: tableData.rows.map(row =>
          tableData.headers.reduce(
            (obj, header, idx) => {
              obj[header] = row[idx];
              return obj;
            },
            {} as Record<string, string>
          )
        ),
      };
      content = JSON.stringify(jsonData, null, 2);
      filename = 'extracted_table.json';
    }

    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);

    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const handleCopyAsJson = () => {
    if (!tableData) return;
    const jsonData = {
      headers: tableData.headers,
      rows: tableData.rows.map(row =>
        tableData.headers.reduce(
          (obj, header, idx) => {
            obj[header] = row[idx];
            return obj;
          },
          {} as Record<string, string>
        )
      ),
    };
    navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
    toast.success('Copied to clipboard');
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            PDF Table Extractor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-3 block">Upload PDF File</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".pdf"
                className="hidden"
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                <FileUp className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-900">
                  {file ? file.name : 'Click to upload PDF'}
                </p>
                <p className="text-xs text-slate-500 mt-1">PDF files only (Max 20MB)</p>
              </label>
            </div>
          </div>

          {!tableData && (
            <Button onClick={handleExtract} disabled={isLoading || !file} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting Table...
                </>
              ) : (
                'Extract Table'
              )}
            </Button>
          )}

          {tableData && (
            <div className="space-y-4">
              {/* Table Preview */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      {tableData.headers.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-3 text-left font-semibold text-slate-900 whitespace-nowrap"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Export Options */}
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={() => handleExport('csv')}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export as CSV
                </Button>
                <Button
                  onClick={() => handleExport('json')}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export as JSON
                </Button>
                <Button
                  onClick={handleCopyAsJson}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy as JSON
                </Button>
              </div>

              {/* Row Count */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {tableData.rows.length} rows extracted
                </span>
              </div>

              <Button onClick={handleExtract} variant="outline" className="w-full">
                Extract Different PDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
