"use client";

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Upload, Trash2 } from 'lucide-react';
import { User, CreateUserRequest, UpdateUserRequest, Workspace } from "@/lib/api";
import { workspacesApi } from "@/lib/api/tenant";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PasswordStrength } from "@/components/auth/password-strength";

const userFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  email: z.string().email("Email invalide address"),
  password: z.string().optional(),
  display_name: z.string().optional(),
  role: z.string().min(1, "Role is required"),
  workspace_ids: z.array(z.string()).optional(),
  avatar_url: z.string().url("Invalid URL").optional().or(z.literal("")),
});

type UserFormValues = {
  username: string;
  email: string;
  password?: string;
  display_name?: string;
  role: string;
  workspace_ids?: string[];
  avatar_url?: string;
};

interface UserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSubmit: (data: CreateUserRequest | UpdateUserRequest) => Promise<void>;
  isLoading: boolean;
}

export function UserSheet({
  open,
  onOpenChange,
  user,
  onSubmit,
  isLoading,
}: UserSheetProps) {
  const isEditing = !!user;
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      display_name: "",
      role: "1", // Default to regular User
      avatar_url: "",
    },
  });

  const watchedPassword = form.watch("password");

  useEffect(() => {
    if (open) {
      if (user) {
        form.reset({
          username: user.username,
          email: user.email || "",
          password: "", // Never populate password on edit
          display_name: user.display_name || "",
          role: user.role.toString(),
          avatar_url: user.avatar_url || "",
        });
      } else {
        form.reset({
          username: "",
          email: "",
          password: "",
          display_name: "",
          role: "1",
          workspace_ids: [],
          avatar_url: "",
        });
      }
      // Load workspaces available to assign
      workspacesApi.list().then((res: any) => {
        setWorkspaces(res.data?.data || res.data || []);
      }).catch(console.error);
    }
  }, [open, user, form]);

  const handleSubmit = async (values: UserFormValues) => {
    if (isEditing) {
      const updateData: UpdateUserRequest = {
        email: values.email,
        display_name: values.display_name,
        role: parseInt(values.role, 10),
        avatar_url: values.avatar_url,
      };
      if (values.password) {
        updateData.password = values.password;
      }
      await onSubmit(updateData);
    } else {
      if (!values.password) {
        form.setError("password", { message: "Password is required for new users" });
        return;
      }
      const createData: CreateUserRequest = {
        username: values.username,
        email: values.email,
        password: values.password,
        display_name: values.display_name,
        role: parseInt(values.role, 10),
        workspace_ids: values.workspace_ids,
        avatar_url: values.avatar_url,
      };
      await onSubmit(createData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-border/40 shadow-2xl glass-panel">
        <div className="p-6 pb-4 border-b border-border/50 bg-muted/10">
          <DialogHeader>
            <div className="flex items-start gap-4 mb-1">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0 shadow-sm ring-1 ring-primary/20">
                  <UserPlus className="h-6 w-6" />
               </div>
               <div className="space-y-1">
                 <DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground text-left">
                   {isEditing ? "Edit User" : "New User"}
                 </DialogTitle>
                 <DialogDescription className="text-[14.5px] font-medium text-muted-foreground leading-snug text-left">
                   {isEditing
                     ? "Modify the user's details and role."
                     : "Add a new user to the platform."}
                 </DialogDescription>
               </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 pt-4 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 transition-colors">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">Username</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="jdoe"
                          disabled={isEditing || isLoading}
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john.doe@example.com"
                          disabled={isLoading}
                          className="h-[52px] bg-sidebar-accent/50 focus-visible:bg-transparent shadow-sm rounded-xl border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-[15px] px-4 transition-all"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs font-semibold text-destructive mt-1.5" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">
                        Display Name <span className="text-muted-foreground/70 font-semibold normal-case tracking-normal ml-1">(Optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
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
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">Role</FormLabel>
                      <Select
                        disabled={isLoading}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-[52px] bg-sidebar-accent/50 focus:bg-transparent shadow-sm rounded-xl border-border focus:ring-1 focus:ring-primary focus:border-primary text-[15px] px-4 transition-all">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl shadow-lg border-border/50">
                          <SelectItem value="0" className="py-3 cursor-pointer">Admin</SelectItem>
                          <SelectItem value="1" className="py-3 cursor-pointer">User</SelectItem>
                          <SelectItem value="2" className="py-3 cursor-pointer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs font-semibold text-destructive mt-1.5" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">
                        {isEditing ? "New Password" : "Password"}
                        {isEditing && <span className="text-muted-foreground/70 font-semibold normal-case tracking-normal ml-1">(Optional)</span>}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={isEditing ? "Leave blank to keep current password" : "Secure password"}
                          disabled={isLoading}
                          className="h-[52px] bg-sidebar-accent/50 focus-visible:bg-transparent shadow-sm rounded-xl border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-[15px] px-4 transition-all"
                          {...field}
                        />
                      </FormControl>
                      {watchedPassword && (
                        <PasswordStrength password={watchedPassword} showRequirements={false} />
                      )}
                      <FormMessage className="text-xs font-semibold text-destructive mt-1.5" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="avatar_url"
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-2">
                      <FormLabel className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">
                        Avatar <span className="text-muted-foreground/70 font-semibold normal-case tracking-normal ml-1">(Optional)</span>
                      </FormLabel>
                      <div className="flex items-center gap-4 mt-2">
                          <Avatar className="h-16 w-16 border-2 border-dashed border-border/50 bg-muted/30">
                              {field.value ? (
                                  <AvatarImage src={field.value} className="object-cover" />
                              ) : (
                                  <AvatarFallback className="bg-transparent text-muted-foreground">
                                      <Upload className="h-6 w-6" />
                                  </AvatarFallback>
                              )}
                          </Avatar>
                          <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                  <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-9 px-4 text-sm font-medium"
                                      disabled={isLoading}
                                      onClick={() => document.getElementById('admin-avatar-upload')?.click()}
                                  >
                                      <Upload className="h-4 w-4 mr-2" />
                                      Upload Image
                                  </Button>
                                  {field.value && (
                                      <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          disabled={isLoading}
                                          onClick={() => field.onChange('')}
                                      >
                                          <Trash2 className="h-4 w-4" />
                                      </Button>
                                  )}
                              </div>
                              <p className="text-xs text-muted-foreground font-medium">
                                  Recommended: 256x256px.
                              </p>
                              <input
                                  id="admin-avatar-upload"
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={isLoading}
                                  onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (event) => {
                                              const img = new Image();
                                              img.onload = () => {
                                                  const canvas = document.createElement('canvas');
                                                  const ctx = canvas.getContext('2d');
                                                  const MAX_SIZE = 256;
                                                  let width = img.width;
                                                  let height = img.height;

                                                  if (width > height) {
                                                      if (width > MAX_SIZE) {
                                                          height *= MAX_SIZE / width;
                                                          width = MAX_SIZE;
                                                      }
                                                  } else {
                                                      if (height > MAX_SIZE) {
                                                          width *= MAX_SIZE / height;
                                                          height = MAX_SIZE;
                                                      }
                                                  }

                                                  canvas.width = width;
                                                  canvas.height = height;
                                                  ctx?.drawImage(img, 0, 0, width, height);

                                                  const dataUrl = canvas.toDataURL('image/webp', 0.8);
                                                  field.onChange(dataUrl);
                                              };
                                              img.src = event.target?.result as string;
                                          };
                                          reader.readAsDataURL(file);
                                      }
                                      e.target.value = '';
                                  }}
                              />
                          </div>
                      </div>
                      <FormMessage className="text-xs font-semibold text-destructive mt-1.5" />
                    </FormItem>
                  )}
                />
              </div>

              {!isEditing && workspaces.length > 0 && (
                <FormField
                  control={form.control}
                  name="workspace_ids"
                  render={() => (
                    <FormItem className="pt-2 border-t border-border/50">
                      <div className="mb-4">
                        <FormLabel className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">Workspaces</FormLabel>
                        <p className="text-[14px] font-medium text-muted-foreground leading-snug text-left mt-1">
                          Assign the user to one or multiple workspaces immediately.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {workspaces.map((workspace) => (
                          <FormField
                            key={workspace.id}
                            control={form.control}
                            name="workspace_ids"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={workspace.id}
                                  className="flex flex-row items-center space-x-3 space-y-0 p-3 rounded-xl border border-border/50 bg-muted/5 hover:bg-muted/20 transition-colors cursor-pointer"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(workspace.id)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        return checked
                                          ? field.onChange([...current, workspace.id])
                                          : field.onChange(
                                              current.filter(
                                                (value) => value !== workspace.id
                                              )
                                            );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-semibold text-[14.5px] cursor-pointer w-full h-full flex items-center">
                                    {workspace.name}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage className="text-xs font-semibold text-destructive mt-1.5" />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border/50 mt-8">
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
                    <><SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-5 w-5 " /> {isEditing ? "Enregistrement..." : "Création..."}</>
                  ) : (
                    isEditing ? "Enregistrer" : "Créer l'utilisateur"
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
