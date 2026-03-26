import { AppLayout } from '@/components/layout/app-layout';
import { SocialNav } from '@/components/social/social-nav';

export default function SocialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <SocialNav />
      {children}
    </AppLayout>
  );
}
