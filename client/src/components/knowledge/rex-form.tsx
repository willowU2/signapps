"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const rexFormSchema = z.object({
  projectName: z.string().min(1, "Project name is required").max(100),
  context: z.string().min(10, "Context must be at least 10 characters"),
  rootCause: z.string().min(10, "Root cause must be at least 10 characters"),
  solution: z.string().min(10, "Solution must be at least 10 characters"),
  lessonsLearned: z.string().min(10, "Lessons must be at least 10 characters"),
});

type RexFormValues = z.infer<typeof rexFormSchema>;

export function RexForm() {
  const form = useForm<RexFormValues>({
    resolver: zodResolver(rexFormSchema),
    defaultValues: {
      projectName: "",
      context: "",
      rootCause: "",
      solution: "",
      lessonsLearned: "",
    },
  });

  const onSubmit = (values: RexFormValues) => {
    toast.success("Retour d'expérience enregistré avec succès");
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-900">Return of Experience (REX)</h3>
          <p className="text-sm text-blue-700 mt-1">
            Share learnings from your project to help the team improve processes
          </p>
        </div>

        <FormField
          control={form.control}
          name="projectName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., SignApps v2.0 Migration" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="context"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Context</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the project scope, timeline, and objectives..."
                  className="min-h-24"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rootCause"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Root Cause Analysis</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What went wrong? What were the underlying causes?"
                  className="min-h-24"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="solution"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Solution Implemented</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="How did you resolve the issue? What steps were taken?"
                  className="min-h-24"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lessonsLearned"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lessons Learned</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Key takeaways and recommendations for future projects..."
                  className="min-h-24"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button type="submit" className="flex-1">
            Save REX
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => form.reset()}
          >
            Clear Form
          </Button>
        </div>
      </form>
    </Form>
  );
}
