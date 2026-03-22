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
import { Switch } from "@/components/ui/switch";


const WEBHOOK_EVENTS = [
  "user.login",
  "user.logout",
  "user.created",
  "user.deleted",
  "container.created",
  "container.started",
  "container.stopped",
  "container.deleted",
  "storage.upload",
  "storage.delete",
  "route.created",
  "route.updated",
  "route.deleted",
];

const webhookFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  url: z.string().url("Must be a valid URL"),
  secret: z.string().optional(),
  events: z.array(z.string()).min(1, "At least one event is required"),
});

type WebhookFormValues = z.infer<typeof webhookFormSchema>;

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  last_triggered?: string;
  last_status?: number;
  created_at: string;
}

interface WebhookSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: WebhookConfig | null;
  onSubmit: (data: Omit<WebhookConfig, "id" | "enabled" | "last_triggered" | "last_status" | "created_at">) => Promise<void>;
  isLoading: boolean;
}

export function WebhookSheet({
  open,
  onOpenChange,
  webhook,
  onSubmit,
  isLoading,
}: WebhookSheetProps) {
  const isEditing = !!webhook;

  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: {
      name: "",
      url: "",
      secret: "",
      events: [],
    },
  });

  useEffect(() => {
    if (open) {
      if (webhook) {
        form.reset({
          name: webhook.name,
          url: webhook.url,
          secret: webhook.secret || "",
          events: webhook.events,
        });
      } else {
        form.reset({
          name: "",
          url: "",
          secret: "",
          events: [],
        });
      }
    }
  }, [open, webhook, form]);

  const toggleEvent = (event: string, currentEvents: string[], onChange: (val: string[]) => void) => {
    if (currentEvents.includes(event)) {
      onChange(currentEvents.filter((e) => e !== event));
    } else {
      onChange([...currentEvents, event]);
    }
  };

  const handleSubmit = async (values: WebhookFormValues) => {
    await onSubmit({
      name: values.name,
      url: values.url,
      secret: values.secret || undefined,
      events: values.events,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Webhook" : "Create Webhook"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modify the webhook's endpoint and subscribed events."
              : "Create a new webhook to receive real-time notifications from SignApps."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Slack Notification" disabled={isLoading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/webhook" disabled={isLoading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secret (Optional)</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="HMAC signing secret" disabled={isLoading} {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-2">
                    Used to sign requests with HMAC-SHA256
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="events"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Events</FormLabel>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-xl p-3 bg-muted/10 border-muted-foreground/10">
                    {WEBHOOK_EVENTS.map((event) => (
                      <div key={event} className="flex items-center space-x-2">
                        <Switch
                          id={`event-${event}`}
                          checked={field.value.includes(event)}
                          onCheckedChange={() => toggleEvent(event, field.value, field.onChange)}
                          disabled={isLoading}
                        />
                        <FormLabel htmlFor={`event-${event}`} className="text-sm font-normal cursor-pointer select-none">
                          {event}
                        </FormLabel>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {field.value.length} event{field.value.length !== 1 ? "s" : ""} selected
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                {isEditing ? "Save Changes" : "Create Webhook"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
