"use client";

import { SpinnerInfinity } from "spinners-react";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";
import { containersApi, CreateContainerRequest } from "@/lib/api";
import { toast } from "sonner";

const portSchema = z.object({
  hostPort: z.string(),
  containerPort: z.string(),
  protocol: z.enum(["tcp", "udp"]),
});

const envSchema = z.object({
  key: z.string(),
  value: z.string(),
});

const volumeSchema = z.object({
  hostPath: z.string(),
  containerPath: z.string(),
});

const containerFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  image: z.string().min(1, "Image is required"),
  restartPolicy: z.enum(["no", "always", "on-failure", "unless-stopped"]),
  ports: z.array(portSchema).optional(),
  envVars: z.array(envSchema).optional(),
  volumes: z.array(volumeSchema).optional(),
});

type ContainerFormValues = z.infer<typeof containerFormSchema>;

interface ContainerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ContainerSheet({
  open,
  onOpenChange,
  onSuccess,
}: ContainerSheetProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<ContainerFormValues>({
    resolver: zodResolver(containerFormSchema),
    defaultValues: {
      name: "",
      image: "",
      restartPolicy: "unless-stopped",
      ports: [],
      envVars: [],
      volumes: [],
    },
  });

  const {
    fields: portFields,
    append: appendPort,
    remove: removePort,
  } = useFieldArray({
    control: form.control,
    name: "ports",
  });

  const {
    fields: envFields,
    append: appendEnv,
    remove: removeEnv,
  } = useFieldArray({
    control: form.control,
    name: "envVars",
  });

  const {
    fields: volumeFields,
    append: appendVolume,
    remove: removeVolume,
  } = useFieldArray({
    control: form.control,
    name: "volumes",
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        image: "",
        restartPolicy: "unless-stopped",
        ports: [],
        envVars: [],
        volumes: [],
      });
    }
  }, [open, form]);

  const handleSubmit = async (values: ContainerFormValues) => {
    setLoading(true);
    try {
      const portsObj: Record<string, string> = {};
      if (values.ports) {
        values.ports.forEach((p) => {
          if (p.containerPort && p.hostPort) {
            portsObj[`${p.containerPort}/${p.protocol}`] = p.hostPort;
          }
        });
      }

      const envObj: Record<string, string> = {};
      if (values.envVars) {
        values.envVars.forEach((e) => {
          if (e.key) {
            envObj[e.key] = e.value;
          }
        });
      }

      const volumesList =
        values.volumes
          ?.filter((v) => v.hostPath && v.containerPath)
          .map((v) => `${v.hostPath}:${v.containerPath}`) || [];

      const request: CreateContainerRequest = {
        name: values.name,
        image: values.image,
        restart_policy: values.restartPolicy,
      };

      if (Object.keys(portsObj).length > 0) {
        request.ports = portsObj;
      }
      if (Object.keys(envObj).length > 0) {
        request.env = envObj;
      }
      if (volumesList.length > 0) {
        request.volumes = volumesList;
      }

      await containersApi.create(request);
      toast.success("Conteneur créé successfully");
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error("Impossible de créer le conteneur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl w-full">
        <SheetHeader>
          <SheetTitle>Create Container</SheetTitle>
          <SheetDescription>
            Deploy a new Docker container with custom network, environment, and
            volume settings.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6 mt-6"
          >
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="ports">Ports</TabsTrigger>
                <TabsTrigger value="env">Environment</TabsTrigger>
                <TabsTrigger value="volumes">Volumes</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="my-container"
                          disabled={loading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="nginx:latest"
                          disabled={loading}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-2">
                        Docker image name with optional tag (e.g., nginx:alpine)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="restartPolicy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restart Policy</FormLabel>
                      <Select
                        disabled={loading}
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="always">Always</SelectItem>
                          <SelectItem value="on-failure">On Failure</SelectItem>
                          <SelectItem value="unless-stopped">
                            Unless Stopped
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="ports" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Port Mappings</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendPort({
                        hostPort: "",
                        containerPort: "",
                        protocol: "tcp",
                      })
                    }
                    disabled={loading}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Port
                  </Button>
                </div>

                {portFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No port mappings configured
                  </p>
                ) : (
                  <div className="space-y-4">
                    {portFields.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-2">
                        <FormField
                          control={form.control}
                          name={`ports.${index}.hostPort`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Host"
                                  disabled={loading}
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <span className="text-muted-foreground pt-2">:</span>
                        <FormField
                          control={form.control}
                          name={`ports.${index}.containerPort`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Container"
                                  disabled={loading}
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`ports.${index}.protocol`}
                          render={({ field }) => (
                            <FormItem className="w-24">
                              <Select
                                disabled={loading}
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="tcp">TCP</SelectItem>
                                  <SelectItem value="udp">UDP</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePort(index)}
                          disabled={loading}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="env" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Environment Variables</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendEnv({ key: "", value: "" })}
                    disabled={loading}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Variable
                  </Button>
                </div>

                {envFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No environment variables configured
                  </p>
                ) : (
                  <div className="space-y-4">
                    {envFields.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-2">
                        <FormField
                          control={form.control}
                          name={`envVars.${index}.key`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="KEY"
                                  disabled={loading}
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(e.target.value.toUpperCase())
                                  }
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <span className="text-muted-foreground pt-2">=</span>
                        <FormField
                          control={form.control}
                          name={`envVars.${index}.value`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Value"
                                  disabled={loading}
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEnv(index)}
                          disabled={loading}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="volumes" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Volume Mounts</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendVolume({ hostPath: "", containerPath: "" })
                    }
                    disabled={loading}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Volume
                  </Button>
                </div>

                {volumeFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No volumes configured
                  </p>
                ) : (
                  <div className="space-y-4">
                    {volumeFields.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-2">
                        <FormField
                          control={form.control}
                          name={`volumes.${index}.hostPath`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="/host/path"
                                  disabled={loading}
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <span className="text-muted-foreground pt-2">:</span>
                        <FormField
                          control={form.control}
                          name={`volumes.${index}.containerPath`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="/container/path"
                                  disabled={loading}
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeVolume(index)}
                          disabled={loading}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={loading}>
                {loading && (
                  <SpinnerInfinity
                    size={24}
                    secondaryColor="rgba(128,128,128,0.2)"
                    color="currentColor"
                    speed={120}
                    className="mr-2 h-4 w-4 "
                  />
                )}
                Create Container
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
