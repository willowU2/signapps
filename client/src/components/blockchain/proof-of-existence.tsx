'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProofRecord {
  id: string;
  fileName: string;
  fileHash: string;
  proofDate: string;
  status: 'verified' | 'pending' | 'failed';
}

interface ProofOfExistenceProps {
  proofs?: ProofRecord[];
  onUpload?: (file: File) => Promise<ProofRecord>;
}

export function ProofOfExistence({ proofs = [], onUpload }: ProofOfExistenceProps) {
  const [uploadedProofs, setUploadedProofs] = useState<ProofRecord[]>(proofs);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await onUpload?.(file);
      if (result) {
        setUploadedProofs((prev) => [result, ...prev]);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusIcon = (status: ProofRecord['status']) => {
    switch (status) {
      case 'verified':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusColor = (status: ProofRecord['status']) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Proof of Existence</CardTitle>
          <CardDescription>Upload files to create cryptographic proofs on blockchain</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-slate-400 transition"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">
              {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Any file type supported</p>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
          </div>
        </CardContent>
      </Card>

      {uploadedProofs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Proof Records</h3>
          {uploadedProofs.map((proof) => (
            <Card key={proof.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(proof.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{proof.fileName}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Hash: {proof.fileHash.slice(0, 24)}...
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(proof.proofDate).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge className={cn('capitalize', getStatusColor(proof.status))}>
                    {proof.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
