'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SsoSamlConfig } from '@/components/security/sso-saml-config';
import { OAuth2AuthServer } from '@/components/security/oauth2-auth-server';
import { HardwareKeyRegistration } from '@/components/security/hardware-key-registration';
import { GeoFencingConfig } from '@/components/security/geo-fencing-config';
import { LoginAnomalyDetection } from '@/components/security/login-anomaly-detection';
import { BruteForceDashboard } from '@/components/security/brute-force-dashboard';
import { CertificateManagement } from '@/components/security/certificate-management';
import { SecurityScorecard } from '@/components/security/security-scorecard';
import { Shield } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/use-page-title';

export default function SecurityPage() {
  usePageTitle('Securite');
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'scorecard';

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Security Center</h1>
            <p className="text-muted-foreground">Manage authentication, access control and compliance</p>
          </div>
        </div>

        <Tabs defaultValue={tab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
            <TabsTrigger value="sso">SSO / SAML</TabsTrigger>
            <TabsTrigger value="oauth2">OAuth2 Server</TabsTrigger>
            <TabsTrigger value="webauthn">Hardware Keys</TabsTrigger>
            <TabsTrigger value="geofencing">Geo-Fencing</TabsTrigger>
            <TabsTrigger value="anomaly">Anomaly Detection</TabsTrigger>
            <TabsTrigger value="bruteforce">Brute Force</TabsTrigger>
            <TabsTrigger value="certs">Certificates</TabsTrigger>
          </TabsList>

          <TabsContent value="scorecard"><SecurityScorecard /></TabsContent>
          <TabsContent value="sso"><SsoSamlConfig /></TabsContent>
          <TabsContent value="oauth2"><OAuth2AuthServer /></TabsContent>
          <TabsContent value="webauthn"><HardwareKeyRegistration /></TabsContent>
          <TabsContent value="geofencing"><GeoFencingConfig /></TabsContent>
          <TabsContent value="anomaly"><LoginAnomalyDetection /></TabsContent>
          <TabsContent value="bruteforce"><BruteForceDashboard /></TabsContent>
          <TabsContent value="certs"><CertificateManagement /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
