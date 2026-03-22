'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileCheck, Copy, Download, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentCertificate {
  documentId: string;
  name: string;
  hash: string;
  certifiedAt: string;
  blockchainReceipt: {
    transactionId: string;
    timestamp: string;
    blockNumber: number;
  };
}

interface DocCertificationProps {
  document: DocumentCertificate;
  onCertify?: () => Promise<void>;
}

export function DocCertification({ document, onCertify }: DocCertificationProps) {
  const [isCertifying, setIsCertifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCertify = async () => {
    setIsCertifying(true);
    try {
      await onCertify?.();
    } finally {
      setIsCertifying(false);
    }
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(document.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortHash = `${document.hash.slice(0, 16)}...${document.hash.slice(-16)}`;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <FileCheck className="w-5 h-5 text-blue-600 mt-1" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{document.name}</CardTitle>
              <CardDescription className="text-xs mt-1">
                Certified on {new Date(document.certifiedAt).toLocaleDateString()}
              </CardDescription>
            </div>
          </div>
          <Badge variant="default" className="bg-green-600 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Certified
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-600 mb-2">SHA-256 Hash</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-slate-700 break-all flex-1">
              {shortHash}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyHash}
              className="flex-shrink-0"
            >
              <Copy className={cn('w-4 h-4', copied && 'text-green-600')} />
            </Button>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-slate-600 mb-2">Blockchain Receipt</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Transaction ID:</span>
              <code className="font-mono text-slate-700 text-xs">
                {document.blockchainReceipt.transactionId.slice(0, 16)}...
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Block Number:</span>
              <span className="font-mono">{document.blockchainReceipt.blockNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Timestamp:</span>
              <span className="text-xs">{new Date(document.blockchainReceipt.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleCertify}
            disabled={isCertifying}
          >
            {isCertifying ? 'Certifying...' : 'Re-certify'}
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
