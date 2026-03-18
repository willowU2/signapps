import { Metadata } from 'next';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata: Metadata = {
  title: 'Planning | SignApps',
  description: 'Gérez votre calendrier, tâches, ressources et équipe',
};

export default function SchedulingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-4rem)]">{children}</div>
    </TooltipProvider>
  );
}
