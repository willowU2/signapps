"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Loader2 } from "lucide-react";
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
      color: "#3B82F6",
    },
  });

  useEffect(() => {
    if (open) {
      if (workspace) {
        form.reset({
          name: workspace.name,
          description: workspace.description || "",
          color: workspace.color || "#3B82F6",
        });
      } else {
        form.reset({
          name: "",
          description: "",
          color: "#3B82F6",
        });
      }
    }
  }, [open, workspace, form]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Workspace" : "Create Workspace"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modify the workspace's configuration and details."
              : "Create a new workspace to organize your projects and resources."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Marketing Team" disabled={isLoading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional description for this workspace"
                      disabled={isLoading}
                      rows={4}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        disabled={isLoading}
                        className="h-10 w-20 cursor-pointer rounded border p-1"
                        {...field}
                      />
                      <span className="text-sm text-muted-foreground font-mono">
                        {field.value}
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Workspace"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
