"use client"

// Compliance hub page — 277–284

import { AppLayout } from "@/components/layout/app-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Timer, UserCheck, Cookie, FileText, ClipboardList, Lock, Calendar } from "lucide-react"
import { DpiaGenerator } from "@/components/compliance/dpia-generator"
import { DataRetentionPolicies } from "@/components/compliance/data-retention-policies"
import { ConsentDashboard } from "@/components/compliance/consent-dashboard"
import { CookieBannerConfig } from "@/components/compliance/cookie-banner-config"
import { PrivacyPolicyGenerator } from "@/components/compliance/privacy-policy-generator"
import { DsarWorkflow } from "@/components/compliance/dsar-workflow"
import { ComplianceAuditTrail } from "@/components/compliance/compliance-audit-trail"
import { RegulatoryCalendar } from "@/components/compliance/regulatory-calendar"
import { usePageTitle } from '@/hooks/use-page-title';

export default function CompliancePage() {
  usePageTitle('Conformite');
  return (
    <AppLayout>
      <div className="w-full space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" /> Compliance & Legal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            DPIA, data retention, consent management, cookie banner, privacy policy, DSAR, audit trail, and regulatory calendar.
          </p>
        </div>

        <Tabs defaultValue="dpia">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="dpia" className="gap-1 text-xs">
              <Shield className="h-3.5 w-3.5" /> DPIA
            </TabsTrigger>
            <TabsTrigger value="retention" className="gap-1 text-xs">
              <Timer className="h-3.5 w-3.5" /> Retention
            </TabsTrigger>
            <TabsTrigger value="consent" className="gap-1 text-xs">
              <UserCheck className="h-3.5 w-3.5" /> Consent
            </TabsTrigger>
            <TabsTrigger value="cookies" className="gap-1 text-xs">
              <Cookie className="h-3.5 w-3.5" /> Cookies
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" /> Privacy Policy
            </TabsTrigger>
            <TabsTrigger value="dsar" className="gap-1 text-xs">
              <ClipboardList className="h-3.5 w-3.5" /> DSAR
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1 text-xs">
              <Lock className="h-3.5 w-3.5" /> Audit Trail
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1 text-xs">
              <Calendar className="h-3.5 w-3.5" /> Calendar
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="dpia">
              <DpiaGenerator />
            </TabsContent>

            <TabsContent value="retention">
              <DataRetentionPolicies />
            </TabsContent>

            <TabsContent value="consent">
              <ConsentDashboard />
            </TabsContent>

            <TabsContent value="cookies">
              <CookieBannerConfig />
            </TabsContent>

            <TabsContent value="privacy">
              <PrivacyPolicyGenerator />
            </TabsContent>

            <TabsContent value="dsar">
              <DsarWorkflow />
            </TabsContent>

            <TabsContent value="audit">
              <ComplianceAuditTrail />
            </TabsContent>

            <TabsContent value="calendar">
              <RegulatoryCalendar />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  )
}
