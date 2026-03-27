'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCheck, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api';

interface ExtractedClause {
  type: string;
  value: string;
  confidence: number;
}

export function ContractExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clauses, setClauses] = useState<ExtractedClause[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }
      setFile(selectedFile);
      setClauses([]);
      toast.info(`Selected: ${selectedFile.name}`);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      toast.error('Please upload a contract');
      return;
    }

    setIsLoading(true);
    try {
      const fileText = await file.text().catch(() => `[Binary file: ${file.name}]`);
      const prompt = `You are a contract analysis AI. Extract key clauses from the following contract and respond ONLY with a valid JSON array, no markdown, no explanation.

Extract these clause types: Parties, Amount, Start Date, End Date, Penalties, Governing Law, Payment Terms, Termination.
Only include clauses that are present in the contract.

For each clause: {"type": "...", "value": "...", "confidence": XX}
where confidence is an integer 0-100.

Contract content:
${fileText.slice(0, 6000)}

Respond with only the JSON array.`;

      const response = await aiApi.chat(prompt, { enableTools: false, includesSources: false });
      const answer = response.data?.answer ?? '';

      let extracted: ExtractedClause[] = [];
      const match = answer.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          extracted = parsed.filter(
            (c: unknown) =>
              c !== null &&
              typeof c === 'object' &&
              'type' in (c as object) &&
              'value' in (c as object) &&
              'confidence' in (c as object)
          );
        }
      }

      if (extracted.length === 0) {
        toast.error('AI could not extract clauses — check the file content');
        return;
      }

      setClauses(extracted);
      toast.success('Contract analysis completed');
    } catch (error) {
      toast.error('Extraction failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-100 text-green-800';
    if (confidence >= 75) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Contract Extractor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-3 block">Upload Contract</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx"
                className="hidden"
                id="contract-upload"
              />
              <label htmlFor="contract-upload" className="cursor-pointer">
                <FileCheck className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-900">
                  {file ? file.name : 'Click to upload or drag file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Max 50MB (PDF, DOC, DOCX)</p>
              </label>
            </div>
          </div>

          {clauses.length === 0 && (
            <Button onClick={handleExtract} disabled={isLoading || !file} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Contract...
                </>
              ) : (
                'Extract Clauses'
              )}
            </Button>
          )}

          {clauses.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-3">
                {clauses.map((clause, index) => (
                  <Card key={index} className="border-slate-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900">{clause.type}</p>
                          <p className="text-sm text-slate-600 mt-1">{clause.value}</p>
                        </div>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getConfidenceColor(clause.confidence)}`}>
                          {clause.confidence}%
                        </span>
                      </div>
                      {clause.confidence < 85 && (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <AlertCircle className="h-3 w-3 text-amber-600 flex-shrink-0" />
                          <p className="text-xs text-amber-700">Review recommended</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button onClick={handleExtract} variant="outline" className="w-full">
                Analyze Another Contract
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
