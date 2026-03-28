'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Download, Eye, Calendar, CheckCircle2, Star, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Certificate {
  id: string;
  courseName: string;
  studentName: string;
  completedAt: Date;
  score: number;
  instructor: string;
  hours: number;
  certNumber: string;
}

const CERTS: Certificate[] = [
  { id: '1', courseName: 'Introduction to SignApps Platform', studentName: 'Etienne Dupont', completedAt: new Date('2026-03-15'), score: 94, instructor: 'Alice Martin', hours: 3, certNumber: 'CERT-2026-001' },
  { id: '2', courseName: 'Advanced Document Management', studentName: 'Etienne Dupont', completedAt: new Date('2026-02-28'), score: 87, instructor: 'Bob Smith', hours: 5, certNumber: 'CERT-2026-002' },
  { id: '3', courseName: 'Security & Compliance Essentials', studentName: 'Etienne Dupont', completedAt: new Date('2026-01-20'), score: 92, instructor: 'Carol Johnson', hours: 4, certNumber: 'CERT-2026-003' },
];

function CertificatePreview({ cert }: { cert: Certificate }) {
  return (
    <div className="bg-white text-slate-900 rounded-2xl border-4 border-yellow-400 p-8 text-center shadow-xl mx-auto max-w-lg">
      <div className="flex justify-center mb-4">
        <div className="h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center border-4 border-yellow-400">
          <Award className="h-8 w-8 text-yellow-600" />
        </div>
      </div>
      <p className="text-sm font-semibold uppercase tracking-widest text-yellow-600 mb-2">Certificate of Completion</p>
      <p className="text-slate-500 text-sm mb-4">This certifies that</p>
      <h2 className="text-3xl font-bold text-slate-900 mb-1">{cert.studentName}</h2>
      <p className="text-slate-500 text-sm mb-4">has successfully completed</p>
      <h3 className="text-xl font-bold text-slate-800 mb-2">{cert.courseName}</h3>
      <div className="flex justify-center gap-6 text-sm text-slate-600 mb-6">
        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-yellow-500" />Score: {cert.score}%</span>
        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(cert.completedAt, 'MMMM d, yyyy')}</span>
      </div>
      <div className="border-t border-slate-200 pt-4">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Instructor: {cert.instructor}</span>
          <span>{cert.certNumber}</span>
        </div>
        <div className="mt-2 text-xs text-slate-400">{cert.hours} hours of learning · SignApps Learning Platform</div>
      </div>
    </div>
  );
}

export default function CertificatesPage() {
  const [preview, setPreview] = useState<Certificate | null>(null);

  const handleDownload = (cert: Certificate) => {
    toast.success(`Downloading ${cert.certNumber}.pdf`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Completion Certificates</h1>
            <p className="text-sm text-muted-foreground">Auto-generated PDF certificates for completed courses</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CERTS.map(cert => (
            <Card key={cert.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0 border-2 border-yellow-400">
                    <Award className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight">{cert.courseName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{cert.instructor}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground">Score</div>
                    <div className="font-bold text-green-600">{cert.score}%</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground">Hours</div>
                    <div className="font-bold">{cert.hours}h</div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{format(cert.completedAt, 'MMM d, yyyy')}</span>
                  <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />
                  <span className="text-green-600">Verified</span>
                </div>

                <div className="text-xs text-muted-foreground font-mono">{cert.certNumber}</div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreview(cert)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />Preview
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => handleDownload(cert)}>
                    <Download className="h-3.5 w-3.5 mr-1" />Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {CERTS.length === 0 && (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-muted-foreground"><Award className="h-12 w-12 mb-3 opacity-30" /><p className="font-medium">No certificates yet</p><p className="text-sm">Complete courses to earn certificates</p></CardContent></Card>
        )}

        <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Award className="h-4 w-4" />Certificate Preview</DialogTitle>
            </DialogHeader>
            {preview && (
              <div className="space-y-4">
                <CertificatePreview cert={preview} />
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => toast.success('Print dialog opened')}><Printer className="h-4 w-4 mr-2" />Print</Button>
                  <Button onClick={() => handleDownload(preview)}><Download className="h-4 w-4 mr-2" />Download PDF</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
