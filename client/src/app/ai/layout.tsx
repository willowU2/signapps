import { AppLayout } from '@/components/layout/app-layout';
import { AiNav } from '@/components/ai/ai-nav';

export default function AiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <AiNav />
      {children}
    </AppLayout>
  );
}
