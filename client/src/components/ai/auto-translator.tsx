'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Languages, Upload, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ru', name: 'Russian' },
];

interface TranslationProgress {
  currentPage: number;
  totalPages: number;
}

export function AutoTranslator() {
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('fr');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [translatedFile, setTranslatedFile] = useState<Blob | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }
      setFile(selectedFile);
      toast.info(`Selected: ${selectedFile.name}`);
    }
  };

  const handleTranslate = async () => {
    if (!file) {
      toast.error('Please upload a file');
      return;
    }

    if (sourceLang === targetLang) {
      toast.error('Les langues source et cible doivent être différentes');
      return;
    }

    setIsLoading(true);
    setProgress({ currentPage: 1, totalPages: 5 });

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          setProgress({ currentPage: 2, totalPages: 5 });

          const prompt = `Translate the following content from ${LANGUAGES.find(l => l.code === sourceLang)?.name || sourceLang} to ${LANGUAGES.find(l => l.code === targetLang)?.name || targetLang}.

Original content:
${content}

Provide only the translated content without any explanations.`;

          setProgress({ currentPage: 3, totalPages: 5 });

          const response = await aiApi.chat(prompt);

          setProgress({ currentPage: 4, totalPages: 5 });

          const translatedContent = response.data.answer;
          const blob = new Blob([translatedContent], { type: 'text/plain' });
          setTranslatedFile(blob);

          setProgress({ currentPage: 5, totalPages: 5 });

          setTimeout(() => {
            setProgress(null);
            setIsLoading(false);
            toast.success('Traduction terminée');
          }, 500);
        } catch (error) {
          setIsLoading(false);
          toast.error('Impossible de traduire le contenu');
        }
      };

      reader.onerror = () => {
        setIsLoading(false);
        toast.error('Impossible de lire le fichier');
      };

      reader.readAsText(file);
    } catch (error) {
      setIsLoading(false);
      toast.error('Translation failed');
    }
  };

  const handleDownload = () => {
    if (!translatedFile || !file) return;

    const extension = file.name.split('.').pop() || 'txt';
    const originalName = file.name.replace(`.${extension}`, '');
    const targetLangName = LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
    const fileName = `${originalName}-${targetLangName}.${extension}`;

    const url = URL.createObjectURL(translatedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File downloaded');
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Auto Translator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Source Language</label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Target Language</label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-3 block">File Upload</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".txt,.pdf,.doc,.docx,.md"
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-900">
                  {file ? file.name : 'Click to upload or drag file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Max 50MB (TXT, PDF, DOC, MD)</p>
              </label>
            </div>
          </div>

          {!translatedFile ? (
            <Button
              onClick={handleTranslate}
              disabled={isLoading || !file}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Translating... {progress && `(${progress.currentPage}/${progress.totalPages})`}
                </>
              ) : (
                'Translate File'
              )}
            </Button>
          ) : (
            <>
              {progress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Progress</span>
                    <span className="text-slate-600">{progress.currentPage}/{progress.totalPages}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.currentPage / progress.totalPages) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {!progress && translatedFile && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-900">Translation completed</p>
                    <p className="text-xs text-green-700">Ready to download</p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleDownload}
                disabled={!translatedFile}
                className="w-full"
                variant={translatedFile ? 'default' : 'outline'}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Translated File
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
