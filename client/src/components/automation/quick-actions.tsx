"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Mail, Calendar, CheckSquare, Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      id: "share",
      label: "Partager",
      icon: <Share2 className="h-5 w-5" />,
      onClick: () => {
        onShare?.();
        setIsOpen(false);
      },
    },
    {
      id: "email",
      label: "Envoyer par email",
      icon: <Mail className="h-5 w-5" />,
      onClick: () => {
        onEmail?.();
        setIsOpen(false);
      },
    },
    {
      id: "schedule",
      label: "Planifier réunion",
      icon: <Calendar className="h-5 w-5" />,
      onClick: () => {
        onSchedule?.();
        setIsOpen(false);
      },
    },
    {
      id: "task",
      label: "Créer tâche",
      icon: <CheckSquare className="h-5 w-5" />,
      onClick: () => {
        onCreateTask?.();
        setIsOpen(false);
      },
    },
    {
      id: "copy",
      label: "Copier lien",
      icon: <Link2 className="h-5 w-5" />,
      onClick: () => {
        onCopyLink?.();
        setIsOpen(false);
      },
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Actions Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={{
              open: {
                transition: { staggerChildren: 0.05, delayChildren: 0.05 },
              },
              closed: {
                transition: { staggerChildren: 0.05, staggerDirection: -1 },
              },
            }}
            className="flex flex-col gap-3 mb-4 items-end"
          >
            {actions.map((action) => (
              <motion.div
                key={action.id}
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 10, scale: 0.8 },
                }}
                className="flex items-center gap-3"
              >
                {/* Tooltip Label */}
                <motion.span
                  className="px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-md border border-border/50 shadow-sm text-sm font-medium text-foreground whitespace-nowrap cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={action.onClick}
                >
                  {action.label}
                </motion.span>

                {/* Action Button */}
                <Button
                  size="icon"
                  className="rounded-full h-12 w-12 bg-background/80 backdrop-blur-md border border-border/50 shadow-lg hover:bg-primary hover:text-primary-foreground hover:shadow-xl transition-all text-muted-foreground mr-1"
                  onClick={action.onClick}
                >
                  {action.icon}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Floating Action Button */}
      <motion.div
        animate={isOpen ? { rotate: 45 } : { rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Button
          size="lg"
          className={cn(
            "rounded-full h-14 w-14 shadow-xl hover:shadow-2xl transition-all border border-border/50",
            isOpen
              ? "bg-accent hover:bg-accent/90 text-accent-foreground"
              : "bg-primary hover:bg-primary/90 text-primary-foreground",
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </motion.div>
    </div>
  );
}
