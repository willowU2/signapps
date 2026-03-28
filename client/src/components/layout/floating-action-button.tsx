'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, X, FileText, Mail, CheckSquare, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCommandBarStore } from '@/stores/command-bar-store';
import { logActivity } from '@/hooks/use-activity-tracker';
import { QuickComposeDialog } from '@/components/mail/quick-compose-dialog';

interface FabAction {
  label: string;
  icon: typeof FileText;
  color: string;
  href?: string;
  action?: string;
}

const ACTIONS: FabAction[] = [
  {
    label: 'Nouveau document',
    icon: FileText,
    href: '/docs?new=true',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    label: 'Nouvel email',
    icon: Mail,
    action: 'openCompose',
    color: 'bg-amber-500 hover:bg-amber-600',
  },
  {
    label: 'Nouvelle tache',
    icon: CheckSquare,
    href: '/tasks?new=true',
    color: 'bg-green-500 hover:bg-green-600',
  },
  {
    label: 'Rechercher',
    icon: Search,
    action: 'openSearch',
    color: 'bg-violet-500 hover:bg-violet-600',
  },
];

export function FloatingActionButton() {
  const [expanded, setExpanded] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const router = useRouter();
  const { setOpen: openCommandBar } = useCommandBarStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [expanded]);

  const handleAction = (action: FabAction) => {
    setExpanded(false);
    if (action.action === 'openSearch') {
      openCommandBar(true);
    } else if (action.action === 'openCompose') {
      logActivity('created', action.label, 'Via quick action');
      setComposeOpen(true);
    } else if (action.href) {
      logActivity('created', action.label, 'Via quick action');
      router.push(action.href);
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col items-end gap-2"
      >
        {/* Action items - shown when expanded */}
        <div
          className={cn(
            'flex flex-col items-end gap-2 transition-all duration-200 origin-bottom',
            expanded
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
          )}
        >
          {ACTIONS.map((action, index) => (
            <button
              key={action.label}
              onClick={() => handleAction(action)}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2.5 text-white shadow-lg transition-all duration-200 text-sm font-medium',
                action.color,
                expanded
                  ? 'translate-x-0 opacity-100'
                  : 'translate-x-4 opacity-0'
              )}
              style={{
                transitionDelay: expanded ? `${index * 50}ms` : '0ms',
              }}
            >
              <action.icon className="h-4 w-4" />
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Main FAB button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 text-white',
            expanded
              ? 'bg-destructive hover:bg-destructive/90 rotate-0'
              : 'bg-primary hover:bg-primary/90 rotate-0'
          )}
          title={expanded ? 'Fermer' : 'Actions rapides'}
        >
          <div
            className={cn(
              'transition-transform duration-300',
              expanded ? 'rotate-45' : 'rotate-0'
            )}
          >
            <Plus className="h-6 w-6" />
          </div>
        </button>
      </div>

      {/* Quick compose dialog - rendered outside the FAB container */}
      <QuickComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </>
  );
}
