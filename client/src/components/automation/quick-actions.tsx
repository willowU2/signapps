'use client';

import { useState } from 'react';
import {
  Share2,
  Mail,
  Calendar,
  CheckSquare,
  Link2,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface QuickActionsProps {
  onShare?: () => void;
  onEmail?: () => void;
  onSchedule?: () => void;
  onCreateTask?: () => void;
  onCopyLink?: () => void;
}

export function QuickActions({
  onShare,
  onEmail,
  onSchedule,
  onCreateTask,
  onCopyLink,
}: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions: QuickAction[] = [
    {
      id: 'share',
      label: 'Partager',
      icon: <Share2 className="h-5 w-5" />,
      onClick: () => {
        onShare?.();
        setIsOpen(false);
      },
    },
    {
      id: 'email',
      label: 'Envoyer par email',
      icon: <Mail className="h-5 w-5" />,
      onClick: () => {
        onEmail?.();
        setIsOpen(false);
      },
    },
    {
      id: 'schedule',
      label: 'Planifier reunion',
      icon: <Calendar className="h-5 w-5" />,
      onClick: () => {
        onSchedule?.();
        setIsOpen(false);
      },
    },
    {
      id: 'task',
      label: 'Creer tache',
      icon: <CheckSquare className="h-5 w-5" />,
      onClick: () => {
        onCreateTask?.();
        setIsOpen(false);
      },
    },
    {
      id: 'copy',
      label: 'Copier lien',
      icon: <Link2 className="h-5 w-5" />,
      onClick: () => {
        onCopyLink?.();
        setIsOpen(false);
      },
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Actions Panel */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-max">
          <div className="flex flex-col gap-2">
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <Button
        size="lg"
        className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-shadow"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </Button>
    </div>
  );
}
