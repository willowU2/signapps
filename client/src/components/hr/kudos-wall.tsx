'use client';

/**
 * Kudos Wall Component
 *
 * Feed of kudos cards showing appreciation messages.
 * Displays sender avatar, receiver name, badge type (Entraide/Innovation/Qualite/Rapidite),
 * and message. Includes form to send kudos.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

export type KudosBadgeType = 'Entraide' | 'Innovation' | 'Qualite' | 'Rapidite';

export interface KudosMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
  receiverName: string;
  badgeType: KudosBadgeType;
  message: string;
  createdAt: Date;
}

export interface KudosWallProps {
  kudos: KudosMessage[];
  onSendKudos?: (data: Omit<KudosMessage, 'id' | 'createdAt'>) => void;
  currentUserId?: string;
  currentUserName?: string;
  className?: string;
}

const kudosSchema = z.object({
  receiverName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  badgeType: z.enum(['Entraide', 'Innovation', 'Qualite', 'Rapidite']),
  message: z.string().min(10, 'Le message doit contenir au moins 10 caractères').max(500),
});

type KudosFormValues = z.infer<typeof kudosSchema>;

const BADGE_COLORS: Record<KudosBadgeType, string> = {
  Entraide: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Innovation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  Qualite: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Rapidite: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function KudosCard({ kudos }: { kudos: KudosMessage }) {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white text-xs font-bold">
            {kudos.senderAvatar || getInitials(kudos.senderName)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              {kudos.senderName} félicite
            </p>
            <p className="text-sm font-semibold">{kudos.receiverName}</p>
          </div>
        </div>
        <Badge className={BADGE_COLORS[kudos.badgeType]}>{kudos.badgeType}</Badge>
      </div>

      <p className="text-sm text-foreground leading-relaxed">{kudos.message}</p>

      <p className="text-xs text-muted-foreground">
        {new Date(kudos.createdAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>
    </div>
  );
}

function SendKudosDialog({
  open,
  onOpenChange,
  onSubmit,
  currentUserName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: KudosFormValues) => void;
  currentUserName?: string;
}) {
  const form = useForm<KudosFormValues>({
    resolver: zodResolver(kudosSchema),
    defaultValues: {
      receiverName: '',
      badgeType: 'Entraide',
      message: '',
    },
  });

  const handleSubmit = (data: KudosFormValues) => {
    onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envoyer un Kudos</DialogTitle>
          <DialogDescription>
            Félicitez un collègue pour sa contribution
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="receiverName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destinataire</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom du collègue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="badgeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de Kudos</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Entraide">Entraide</SelectItem>
                      <SelectItem value="Innovation">Innovation</SelectItem>
                      <SelectItem value="Qualite">Qualité</SelectItem>
                      <SelectItem value="Rapidite">Rapidité</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Décrivez la contribution du collègue..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit">Envoyer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function KudosWall({
  kudos,
  onSendKudos,
  currentUserName = 'Utilisateur',
  className,
}: KudosWallProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleFormSubmit = async (data: KudosFormValues) => {
    setIsSubmitting(true);
    try {
      onSendKudos?.({
        senderId: 'current-user',
        senderName: currentUserName,
        receiverId: 'temp-id',
        ...data,
      });
      toast.success('Kudos envoyé avec succès');
    } catch (error) {
      toast.error('Erreur lors de l\'envoi du kudos');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedKudos = [...kudos].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Mur des Kudos</h2>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
          <Plus size={16} />
          Envoyer un Kudos
        </Button>
      </div>

      <SendKudosDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleFormSubmit}
        currentUserName={currentUserName}
      />

      {sortedKudos.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-40 text-muted-foreground">
            Aucun kudos pour le moment. Soyez le premier à en envoyer un !
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedKudos.map((k) => (
            <KudosCard key={k.id} kudos={k} />
          ))}
        </div>
      )}
    </div>
  );
}
