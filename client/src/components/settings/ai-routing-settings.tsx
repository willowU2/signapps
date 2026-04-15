"use client";

import { SpinnerInfinity } from "spinners-react";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, FileText, Mail, Presentation, MonitorDot } from "lucide-react";
import { useAiRouting, AiRole } from "@/hooks/use-ai-routing";
import { aiApi, ProviderInfo, Model } from "@/lib/api";

const ROLES: {
  id: AiRole;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "default",
    label: "Default Fallback",
    icon: <MonitorDot className="h-4 w-4" />,
    description: "Used when a specific role is not configured",
  },
  {
    id: "chat",
    label: "Global Chat",
    icon: <Bot className="h-4 w-4" />,
    description: "General queries and chatbot interactions",
  },
  {
    id: "docs",
    label: "Document AI",
    icon: <FileText className="h-4 w-4" />,
    description: "Text summarization, rewriting, and generation in Docs",
  },
  {
    id: "mail",
    label: "Mail Assistant",
    icon: <Mail className="h-4 w-4" />,
    description: "Smart replies and thread summarization",
  },
  {
    id: "slides",
    label: "Magic Layout",
    icon: <Presentation className="h-4 w-4" />,
    description: "JSON-based strict generation for Slides layouts",
  },
];

export function AiRoutingSettings() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const { routes, setRouteTarget } = useAiRouting();

  useEffect(() => {
    async function fetchProviders() {
      try {
        const response = await aiApi.providers();
        setProviders(response.data.providers || []);
      } catch (err) {
        console.warn("Failed to load AI providers", err);
      } finally {
        setLoadingProviders(false);
      }
    }
    fetchProviders();
  }, []);

  if (loadingProviders) {
    return (
      <div className="flex items-center justify-center p-8">
        <SpinnerInfinity
          size={24}
          secondaryColor="rgba(128,128,128,0.2)"
          color="currentColor"
          speed={120}
          className="h-8 w-8  text-muted-foreground"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">AI Model Routing</h2>
        <p className="text-sm text-muted-foreground">
          Configure which AI provider and model handles specific tasks across
          the platform.
        </p>
      </div>

      <div className="grid gap-6">
        {ROLES.map((role) => (
          <RoleConfigRow key={role.id} role={role} providers={providers} />
        ))}
      </div>
    </div>
  );
}

function RoleConfigRow({
  role,
  providers,
}: {
  role: {
    id: AiRole;
    label: string;
    icon: React.ReactNode;
    description: string;
  };
  providers: ProviderInfo[];
}) {
  const { routes, setRouteTarget } = useAiRouting();
  const currentConfig = routes[role.id];

  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load models whenever the provider changes
  useEffect(() => {
    if (!currentConfig.providerId) {
      setModels([]);
      return;
    }

    let isMounted = true;
    async function fetchModels() {
      setLoadingModels(true);
      try {
        const response = await aiApi.models(currentConfig.providerId!);
        if (isMounted) {
          setModels(response.data.models || []);
        }
      } catch (error) {
        console.warn(
          "Failed to fetch models for provider",
          currentConfig.providerId,
        );
      } finally {
        if (isMounted) setLoadingModels(false);
      }
    }
    fetchModels();

    return () => {
      isMounted = false;
    };
  }, [currentConfig.providerId]);

  const handleProviderChange = (providerId: string) => {
    // When changing provider, reset the model
    setRouteTarget(role.id, providerId, "");
  };

  const handleModelChange = (modelId: string) => {
    if (currentConfig.providerId) {
      setRouteTarget(role.id, currentConfig.providerId, modelId);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          {role.icon}
          <CardTitle className="text-base">{role.label}</CardTitle>
        </div>
        <CardDescription>{role.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-2">
          <Label>Provider</Label>
          <Select
            value={currentConfig.providerId || "unassigned"}
            onValueChange={(val) =>
              handleProviderChange(val === "unassigned" ? "" : val)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="unassigned"
                className="text-muted-foreground italic"
              >
                None (Fallback)
              </SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 space-y-2">
          <Label className="flex items-center gap-2">
            Model
            {loadingModels && (
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-3 w-3  text-muted-foreground"
              />
            )}
          </Label>
          <Select
            value={currentConfig.modelId || "unassigned"}
            onValueChange={handleModelChange}
            disabled={!currentConfig.providerId || loadingModels}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !currentConfig.providerId
                    ? "Select a provider first"
                    : "Select model"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="unassigned"
                className="text-muted-foreground italic"
              >
                None
              </SelectItem>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name || m.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
