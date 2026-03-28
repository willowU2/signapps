'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BusinessCardGenerator } from '@/components/print/business-card-generator';
import { CertificateGenerator } from '@/components/print/certificate-generator';
import { LabelPrinting } from '@/components/print/label-printing';
import { BadgePrinting } from '@/components/print/badge-printing';
import { LetterheadTemplate } from '@/components/print/letterhead-template';
import { EnvelopeAddressing } from '@/components/print/envelope-addressing';
import { CreditCard, Award, Tag, Shield, FileText, Mail } from 'lucide-react';

export default function PrintPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Print & Physical</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate business cards, certificates, labels, badges, letterheads, and envelopes
          </p>
        </div>

        <Tabs defaultValue="business-card">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="business-card" className="gap-1 text-xs">
              <CreditCard className="h-3.5 w-3.5" />Cards
            </TabsTrigger>
            <TabsTrigger value="certificate" className="gap-1 text-xs">
              <Award className="h-3.5 w-3.5" />Certificates
            </TabsTrigger>
            <TabsTrigger value="labels" className="gap-1 text-xs">
              <Tag className="h-3.5 w-3.5" />Labels
            </TabsTrigger>
            <TabsTrigger value="badges" className="gap-1 text-xs">
              <Shield className="h-3.5 w-3.5" />Badges
            </TabsTrigger>
            <TabsTrigger value="letterhead" className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" />Letterhead
            </TabsTrigger>
            <TabsTrigger value="envelopes" className="gap-1 text-xs">
              <Mail className="h-3.5 w-3.5" />Envelopes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="business-card" className="mt-4"><BusinessCardGenerator /></TabsContent>
          <TabsContent value="certificate" className="mt-4"><CertificateGenerator /></TabsContent>
          <TabsContent value="labels" className="mt-4"><LabelPrinting /></TabsContent>
          <TabsContent value="badges" className="mt-4"><BadgePrinting /></TabsContent>
          <TabsContent value="letterhead" className="mt-4"><LetterheadTemplate /></TabsContent>
          <TabsContent value="envelopes" className="mt-4"><EnvelopeAddressing /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
