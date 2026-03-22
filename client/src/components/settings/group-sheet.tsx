"use client";

import { SpinnerInfinity } from 'spinners-react';

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

import { Group, CreateGroupRequest } from "@/lib/api";

const groupFormSchema = z.object({
  name: z.string().min(2, "Group name must be at least 2 characters").max(50),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;

interface GroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group | null;
  onSubmit: (data: CreateGroupRequest | Partial<CreateGroupRequest>) => Promise<void>;
  isLoading: boolean;
}

export function GroupSheet({
  open,
  onOpenChange,
  group,
  onSubmit,
  isLoading,
}: GroupSheetProps) {
  const isEditing = !!group;

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (group) {
        form.reset({
          name: group.name,
          description: group.description || "",
        });
      } else {
        form.reset({
          name: "",
          description: "",
        });
      }
    }
  }, [open, group, form]);

  const handleSubmit = async (values: GroupFormValues) => {
    // Only extract necessary fields to send to the backend
    const submissionData: CreateGroupRequest | Partial<CreateGroupRequest> = {
      name: values.name,
      description: values.description || undefined,
    };
    await onSubmit(submissionData);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Group" : "Create Group"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modify the group's properties and settings."
              : "Create a new group to organize users and manage permissions."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Developers"
                      disabled={isLoading}
                      {...field}
                    />
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
                      placeholder="Optional description for this group"
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

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                {isEditing ? "Save Changes" : "Create Group"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
