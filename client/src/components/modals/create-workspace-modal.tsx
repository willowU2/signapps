import { SpinnerInfinity } from 'spinners-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '@/lib/utils';
import { useEntityStore } from '@/stores/entity-hub-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';

const workspaceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});

type WorkspaceFormValues = z.infer<typeof workspaceSchema>;

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceModal({ open, onOpenChange }: CreateWorkspaceModalProps) {
  const { createWorkspace } = useEntityStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = async (data: WorkspaceFormValues) => {
    setIsSubmitting(true);
    try {
      await createWorkspace(data);
      toast.success('Workspace created successfully');
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/40 shadow-2xl glass-panel">
        <div className="p-6 pb-4 border-b border-border/50 bg-muted/10">
          <DialogHeader>
            <div className="flex items-start gap-4 mb-1">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0 shadow-sm ring-1 ring-primary/20">
                  <Building2 className="h-6 w-6" />
               </div>
               <div className="space-y-1">
                 <DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground">
                   Create Workspace
                 </DialogTitle>
                 <DialogDescription className="text-[14.5px] font-medium text-muted-foreground leading-snug">
                   Workspaces are isolated environments for different teams or departments.
                 </DialogDescription>
               </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 pt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">Workspace Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. Acme Corp internal" 
                        disabled={isSubmitting}
                        className="h-[52px] bg-sidebar-accent/50 focus-visible:bg-transparent shadow-sm rounded-xl border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-[15px] px-4 transition-all"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-semibold text-destructive mt-1.5" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">
                      Description <span className="text-muted-foreground/70 font-semibold normal-case tracking-normal ml-1">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What is this workspace used for?"
                        className="resize-none bg-sidebar-accent/50 focus-visible:bg-transparent shadow-sm rounded-xl border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-[15px] p-4 transition-all"
                        disabled={isSubmitting}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-semibold text-destructive mt-1.5" />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="h-[52px] px-6 rounded-xl text-[15px] font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="h-[52px] px-8 rounded-xl text-[15px] bg-[#4d51f2] hover:bg-[#4d51f2]/90 text-white shadow-sm font-bold transition-all hover:-translate-y-0.5"
                >
                  {isSubmitting ? (
                    <><SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-5 w-5 " /> Creating...</>
                  ) : (
                    'Create Workspace'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
