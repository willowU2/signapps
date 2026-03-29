'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api';

interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  variables: string[];
}

interface FormData {
  template: string;
  clientName: string;
  startDate: string;
  endDate: string;
  amount: string;
  currency: string;
}

const TEMPLATES: ContractTemplate[] = [
  {
    id: 'service',
    name: 'Service Agreement',
    description: 'Professional services contract',
    variables: ['Client Name', 'Start Date', 'End Date', 'Service Description', 'Amount'],
  },
  {
    id: 'nda',
    name: 'Non-Disclosure Agreement',
    description: 'Confidentiality agreement',
    variables: ['Client Name', 'Effective Date', 'Confidentiality Period'],
  },
  {
    id: 'purchase',
    name: 'Purchase Agreement',
    description: 'Goods purchase contract',
    variables: ['Seller', 'Buyer', 'Product', 'Amount', 'Delivery Date'],
  },
];

export function ContractGenerator() {
  const [formData, setFormData] = useState<FormData>({
    template: '',
    clientName: '',
    startDate: '',
    endDate: '',
    amount: '',
    currency: 'EUR',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);

  const handleTemplateSelect = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setFormData({ ...formData, template: templateId });
      setGeneratedPreview(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.template || !formData.clientName || !formData.startDate) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setIsLoading(true);
    try {
      const templateName = TEMPLATES.find(t => t.id === formData.template)?.name ?? formData.template;
      const prompt = `Generate a professional ${templateName} contract with the following parameters:
- Client/Party: ${formData.clientName}
- Start Date: ${formData.startDate}
- End Date: ${formData.endDate || 'Not specified'}
- Amount: ${formData.amount ? `${formData.amount} ${formData.currency}` : 'To be agreed'}

Write a complete, professional contract in plain text (no markdown). Include all standard clauses for this type of contract: parties, term, compensation, obligations, confidentiality, termination, governing law, and signature block.`;

      const response = await aiApi.chat(prompt, { enableTools: false, includesSources: false });
      const contractText = response.data?.answer ?? '';

      if (!contractText.trim()) {
        toast.error('AI did not generate a contract — try again');
        return;
      }

      setGeneratedPreview(contractText);
      toast.success('Contrat généré avec succès');
    } catch (error) {
      toast.error('Impossible de générer le contrat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedPreview) {
      toast.error('Aucun contrat à télécharger');
      return;
    }

    const blob = new Blob([generatedPreview], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contract-${Date.now()}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast.success('Contrat téléchargé');
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template Selection */}
          {!selectedTemplate ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Select Template</h3>
              <div className="grid grid-cols-1 gap-3">
                {TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className="p-4 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-left"
                  >
                    <p className="font-semibold text-foreground">{template.name}</p>
                    <p className="text-xs text-slate-600 mt-1">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Form Fields */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Contract Details</h3>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-2">Client Name *</label>
                  <input
                    type="text"
                    name="clientName"
                    value={formData.clientName}
                    onChange={handleInputChange}
                    placeholder="Enter client name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-2">Start Date *</label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-2">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 block mb-2">Amount</label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      step="0.01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-2">Currency</label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
              </div>

              {!generatedPreview ? (
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => setSelectedTemplate(null)} variant="outline">
                    Change Template
                  </Button>
                  <Button onClick={handleGenerate} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Contract
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Preview */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">{generatedPreview}</pre>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={handleDownload} className="bg-green-600 hover:bg-green-700">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button onClick={handleGenerate} variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Generate New
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
