"use client";

import { SpinnerInfinity } from 'spinners-react';

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building2 } from 'lucide-react';
import type { Workspace } from "@/lib/api/tenant";

const workspaceFormSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters").max(50),
  description: z.string().optional(),
  color: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Must be a valid hex color code"),
});

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

interface WorkspaceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace | null;
  onSubmit: (data: WorkspaceFormValues) => Promise<void>;
  isLoading: boolean;
}

const PRESET_COLORS = [
  '#4d51f2', // Primary Brand
  '#0ea5e9', // Base Ocean
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#64748b', // Slate
];

export function WorkspaceSheet({
  open,
  onOpenChange,
  workspace,
  onSubmit,
  isLoading,
}: WorkspaceSheetProps) {
  const isEditing = !!workspace;

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#4d51f2",
    },
  });

  useEffect(() => {
    if (open) {
      if (workspace) {
        form.reset({
          name: workspace.name,
          description: workspace.description || "",
          color: workspace.color || "#4d51f2",
        });
      } else {
        form.reset({
          name: "",
          description: "",
          color: "#4d51f2",
        });
      }
    }
  }, [open, workspace, form]);

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
                 <DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground text-left">
                   {isEditing ? "Edit Workspace" : "New Workspace"}
                 </DialogTitle>
                 <DialogDescription className="text-[14.5px] font-medium text-muted-foreground leading-snug text-left">
                   {isEditing
                     ? "Modify the workspace's configuration and details."
                     : "Create a new workspace to organize your team's projects."}
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
                        placeholder="e.g., Marketing Team" 
                        disabled={isLoading} 
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
                        placeholder="Optional description for this workspace"
                        disabled={isLoading}
                        rows={3}
                        className="resize-none bg-sidebar-accent/50 focus-visible:bg-transparent shadow-sm rounded-xl border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-[15px] p-4 transition-all"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-semibold text-destructive mt-1.5" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">Brand Color</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-4 p-4 rounded-xl border border-border bg-sidebar-accent/30 shadow-sm">
                        <div className="flex flex-wrap gap-3">
                          {PRESET_COLORS.map((preset) => (
                             <button
                               key={preset}
                               type="button"
                               className={cn(
                                 "w-8 h-8 rounded-full shadow-sm ring-offset-background transition-all duration-200 hover:scale-110",
                                 field.value.toLowerCase() === preset.toLowerCase() ? "ring-2 ring-primary ring-offset-2 scale-110" : "ring-1 ring-border/50 opacity-80 hover:opacity-100"
                               )}
                               style={{ backgroundColor: preset }}
                               onClick={() => field.onChange(preset)}
                             />
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-border/60">
                          <span className="text-[13px] font-bold text-muted-foreground tracking-tight">Custom HEX:</span>
                          <div className="flex items-center gap-2.5 bg-background border border-border rounded-lg p-1.5 pr-4 shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                            <input
                              type="color"
                              disabled={isLoading}
                              className="h-7 w-7 cursor-pointer rounded overflow-hidden border-0 p-0"
                              {...field}
                            />
                            <span className="text-xs font-mono uppercase font-bold text-foreground">
                              {field.value || "#000000"}
                            </span>
                          </div>
                        </div>
                      </div>
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
                  disabled={isLoading}
                  className="h-[52px] px-6 rounded-xl text-[15px] font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="h-[52px] px-8 rounded-xl text-[15px] bg-[#4d51f2] hover:bg-[#4d51f2]/90 text-white shadow-sm font-bold transition-all hover:-translate-y-0.5"
                >
                  {isLoading ? (
                    <><SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-5 w-5 " /> {isEditing ? "Saving..." : "Creating..."}</>
                  ) : (
                    isEditing ? "Save Workspace" : "Create Workspace"
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
