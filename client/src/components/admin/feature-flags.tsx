"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  targetingPercent: number;
  description: string;
}

const flagFormSchema = z.object({
  name: z.string().min(1, "Flag name is required").max(50),
  description: z.string().max(200).optional(),
});

type FlagFormValues = z.infer<typeof flagFormSchema>;

const MOCK_FLAGS: FeatureFlag[] = [
  {
    id: "1",
    name: "advanced_search",
    enabled: true,
    targetingPercent: 100,
    description: "Advanced search with filters and facets",
  },
  {
    id: "2",
    name: "dark_mode",
    enabled: true,
    targetingPercent: 75,
    description: "Dark mode UI support",
  },
  {
    id: "3",
    name: "ai_assistant",
    enabled: false,
    targetingPercent: 25,
    description: "AI-powered assistant features",
  },
  {
    id: "4",
    name: "offline_mode",
    enabled: true,
    targetingPercent: 50,
    description: "Offline-first document editing",
  },
  {
    id: "5",
    name: "webhooks",
    enabled: false,
    targetingPercent: 10,
    description: "Webhook integrations",
  },
];

export function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<FlagFormValues>({
    resolver: zodResolver(flagFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    setFlags(MOCK_FLAGS);
    setIsLoading(false);
  }, []);

  const handleToggle = (id: string) => {
    setFlags((prev) =>
      prev.map((flag) =>
        flag.id === id ? { ...flag, enabled: !flag.enabled } : flag
      )
    );
  };

  const handleTargetingChange = (id: string, percent: number) => {
    const boundedPercent = Math.max(0, Math.min(100, percent));
    setFlags((prev) =>
      prev.map((flag) =>
        flag.id === id ? { ...flag, targetingPercent: boundedPercent } : flag
      )
    );
  };

  const handleDeleteFlag = (id: string) => {
    setFlags((prev) => prev.filter((flag) => flag.id !== id));
  };

  const onSubmit = async (data: FlagFormValues) => {
    const newFlag: FeatureFlag = {
      id: Date.now().toString(),
      name: data.name,
      enabled: false,
      targetingPercent: 0,
      description: data.description || "",
    };
    setFlags((prev) => [...prev, newFlag]);
    form.reset();
    setIsDialogOpen(false);
  };

  if (isLoading) {
    return <div className="text-center text-gray-500">Loading flags...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Feature Flags</h2>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Flag
        </Button>
      </div>

      {/* Flags Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Targeting %
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {flags.map((flag) => (
                <tr key={flag.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {flag.name}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggle(flag.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        flag.enabled ? "bg-green-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          flag.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={flag.targetingPercent}
                        onChange={(e) =>
                          handleTargetingChange(flag.id, parseInt(e.target.value))
                        }
                        className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-sm text-gray-600 w-8 text-right">
                        {flag.targetingPercent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {flag.description || "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteFlag(flag.id)}
                      className="text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Flag Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Feature Flag</DialogTitle>
            <DialogDescription>
              Add a new feature flag to manage rollout
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flag Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., new_dashboard" {...field} />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="What does this flag control?"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Create Flag
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
