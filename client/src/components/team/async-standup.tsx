'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { SpinnerInfinity } from 'spinners-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const standupSchema = z.object({
  yesterday: z.string().min(1, 'Veuillez décrire ce que vous avez fait hier.'),
  today: z.string().min(1, 'Veuillez décrire ce que vous faites aujourd\'hui.'),
  blockers: z.string().optional().nullable(),
});

type StandupFormValues = z.infer<typeof standupSchema>;

interface TeamStandup {
  id: string;
  author: string;
  timestamp: string;
  yesterday: string;
  today: string;
  blockers?: string;
}

interface AsyncStandupProps {
  onStandupSubmitted?: (standup: TeamStandup) => void;
  initialStandups?: TeamStandup[];
}

export function AsyncStandup({ onStandupSubmitted, initialStandups = [] }: AsyncStandupProps) {
  const [standups, setStandups] = useState<TeamStandup[]>(initialStandups);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<StandupFormValues>({
    resolver: zodResolver(standupSchema),
    defaultValues: { yesterday: '', today: '', blockers: '' },
  });

  const onSubmit = async (values: StandupFormValues) => {
    setIsSubmitting(true);
    try {
      const newStandup: TeamStandup = {
        id: Date.now().toString(),
        author: 'Utilisateur courant',
        timestamp: new Date().toLocaleString('fr-FR'),
        yesterday: values.yesterday,
        today: values.today,
        blockers: values.blockers || undefined,
      };
      setStandups([newStandup, ...standups]);
      if (onStandupSubmitted) onStandupSubmitted(newStandup);
      form.reset();
      toast.success('Standup soumis avec succès');
    } catch (error) {
      toast.error('Erreur lors de la soumission du standup');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Standup Asynchrone Quotidien</CardTitle>
          <CardDescription>Partagez votre progression avec l'équipe. Cela prend environ 2-3 minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="yesterday" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Hier</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Qu'avez-vous accompli hier ?" className="resize-none min-h-24" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="today" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Aujourd'hui</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Qu'allez-vous faire aujourd'hui ?" className="resize-none min-h-24" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="blockers" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Blocages</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Y a-t-il quelque chose qui vous bloque ? (Optionnel)" className="resize-none min-h-20" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <SpinnerInfinity size={20} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} />}
                  Soumettre le Standup
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div>
        <h2 className="text-xl font-bold mb-4">Standups de l'Équipe d'Aujourd'hui</h2>
        {standups.length === 0 ? (
          <Card><CardContent className="pt-6"><p className="text-muted-foreground text-center">Aucun standup soumis pour aujourd'hui.</p></CardContent></Card>
        ) : (
          <div className="space-y-4">
            {standups.map((standup) => (
              <Card key={standup.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{standup.author}</Badge>
                    <span className="text-sm text-muted-foreground">{standup.timestamp}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-1">✓ Hier</h4>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{standup.yesterday}</p>
                  </div>
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">→ Aujourd'hui</h4>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{standup.today}</p>
                  </div>
                  {standup.blockers && (
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">⚠ Blocages</h4>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{standup.blockers}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
