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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { User, CreateUserRequest, UpdateUserRequest } from "@/lib/api";

const userFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  email: z.string().email("Invalid email address"),
  password: z.string().optional(),
  display_name: z.string().optional(),
  role: z.string().min(1, "Role is required"),
});

type UserFormValues = {
  username: string;
  email: string;
  password?: string;
  display_name?: string;
  role: string;
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

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      display_name: "",
      role: "1", // Default to regular User
    },
  });

  useEffect(() => {
    if (open) {
      if (user) {
        form.reset({
          username: user.username,
          email: user.email || "",
          password: "", // Never populate password on edit
          display_name: user.display_name || "",
          role: user.role.toString(),
        });
      } else {
        form.reset({
          username: "",
          email: "",
          password: "",
          display_name: "",
          role: "1",
        });
      }
    }
  }, [open, user, form]);

  const handleSubmit = async (values: UserFormValues) => {
    if (isEditing) {
      const updateData: UpdateUserRequest = {
        email: values.email,
        display_name: values.display_name,
        role: parseInt(values.role, 10),
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
      };
      await onSubmit(createData);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit User" : "Create User"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modify the user's details and role."
              : "Add a new user to the platform."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="jdoe"
                      disabled={isEditing || isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john.doe@example.com"
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
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    disabled={isLoading}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="3">SuperAdmin</SelectItem>
                      <SelectItem value="2">Admin</SelectItem>
                      <SelectItem value="1">User</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEditing ? "New Password (Optional)" : "Password"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={isEditing ? "Leave blank to keep current" : "Secure password"}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create User"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
