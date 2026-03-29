'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api';

interface ExtractedField {
  label: string;
  value: string;
  confidence: number;
}

export function InvoiceOcr() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedField[]>([]);
  const [isValidated, setIsValidated] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(selectedFile.type)) {
        toast.error('Only PDF and image files are supported');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setFile(selectedFile);
      setExtracted([]);
      setIsValidated(false);
      toast.success(`Selected: ${selectedFile.name}`);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      toast.error('Please upload an invoice');
      return;
    }

    setIsLoading(true);
    try {
      const fileText = await file.text().catch(() => `[Binary file: ${file.name}, type: ${file.type}]`);
      const prompt = `You are an invoice OCR system. Extract the following fields from this invoice document and respond ONLY with a valid JSON array, no markdown, no explanation.

Fields to extract: Vendor Name, Invoice Amount, VAT (TVA), IBAN, Invoice Date.

For each field provide: {"label": "...", "value": "...", "confidence": 0.XX}
where confidence is between 0 and 1.

Invoice content:
${fileText.slice(0, 4000)}

Respond with only the JSON array, example format:
[{"label":"Vendor Name","value":"Acme Corp","confidence":0.95}]`;

      const response = await aiApi.chat(prompt, { enableTools: false, includesSources: false });
      const answer = response.data?.answer ?? '';

      let fields: ExtractedField[] = [];
      const match = answer.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          fields = parsed.filter(
            (f: unknown) =>
              f !== null &&
              typeof f === 'object' &&
              'label' in (f as object) &&
              'value' in (f as object) &&
              'confidence' in (f as object)
          );
        }
      }

      if (fields.length === 0) {
        toast.error('AI could not extract invoice fields — check the file content');
        return;
      }

      setExtracted(fields);
      setIsValidated(false);
      toast.success('Invoice extracted successfully');
    } catch (error) {
      toast.error('Failed to extract invoice data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = () => {
    setIsValidated(true);
    toast.success('Invoice validated and ready for processing');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.95) return 'text-green-600';
    if (confidence >= 0.90) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Invoice OCR Extraction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-3 block">Upload Invoice</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                id="invoice-upload"
              />
              <label htmlFor="invoice-upload" className="cursor-pointer">
                <FileUp className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-foreground">
                  {file ? file.name : 'Click to upload invoice'}
                </p>
                <p className="text-xs text-slate-500 mt-1">PDF or Image (Max 10MB)</p>
              </label>
            </div>
          </div>

          {extracted.length === 0 && (
            <Button onClick={handleExtract} disabled={isLoading || !file} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                'Extract Fields'
              )}
            </Button>
          )}

          {extracted.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-3">
                {extracted.map((field) => (
                  <div key={field.label} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-500 uppercase">{field.label}</p>
                      <p className="text-sm font-semibold text-foreground mt-1">{field.value}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-medium ${getConfidenceColor(field.confidence)}`}>
                        {(field.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {!isValidated ? (
                <Button onClick={handleValidate} className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Validate & Proceed
                </Button>
              ) : (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Invoice validated</span>
                </div>
              )}

              <Button onClick={handleExtract} variant="outline" className="w-full">
                Extract New Invoice
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
