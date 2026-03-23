'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function DocSummarizer() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }
      setFile(selectedFile);
      setSummary([]);
      toast.info(`Selected: ${selectedFile.name}`);
    }
  };

  const handleGenerateSummary = async () => {
    if (!file) {
      toast.error('Please upload a document');
      return;
    }

    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;

          // Mock AI processing - replace with actual API call
          const mockKeyPoints = [
            'Document main objective clearly defined',
            'Key findings and conclusions outlined',
            'Implementation timeline specified',
            'Risk mitigation strategies identified',
            'Stakeholder requirements documented',
          ];

          setSummary(mockKeyPoints);
          toast.success('Summary generated successfully');
        } catch (error) {
          toast.error('Failed to generate summary');
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      setIsLoading(false);
      toast.error('Summary generation failed');
    }
  };

  const handleCopy = () => {
    const text = summary.join('\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Summarizer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-3 block">Upload Document</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".txt,.pdf,.doc,.docx,.md"
                className="hidden"
                id="doc-upload"
              />
              <label htmlFor="doc-upload" className="cursor-pointer">
                <FileText className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-900">
                  {file ? file.name : 'Click to upload or drag file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Max 50MB (TXT, PDF, DOC, MD)</p>
              </label>
            </div>
          </div>

          {summary.length === 0 && (
            <Button onClick={handleGenerateSummary} disabled={isLoading || !file} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Resume...
                </>
              ) : (
                'Generer Resume'
              )}
            </Button>
          )}

          {summary.length > 0 && (
            <div className="space-y-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Key Points</span>
                    <Button
                      onClick={handleCopy}
                      size="sm"
                      variant="ghost"
                      className="gap-2"
                    >
                      {isCopied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {summary.map((point, index) => (
                      <li key={index} className="flex gap-3">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-medium flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-sm text-slate-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Button onClick={handleGenerateSummary} variant="outline" className="w-full">
                Generate New Summary
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
