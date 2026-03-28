"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

const brandingSchema = z.object({
  orgName: z.string().min(1, "Organization name is required").max(100),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color"),
});

type BrandingValues = z.infer<typeof brandingSchema>;

export function BrandingConfig() {
  const [logoUrl, setLogoUrl] = useState("https://via.placeholder.com/150");
  const [preview, setPreview] = useState({
    orgName: "SignApps",
    primaryColor: "#3b82f6",
  });

  const form = useForm<BrandingValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      orgName: "SignApps",
      primaryColor: "#3b82f6",
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoUrl(event.target?.result as string);
        toast.success("Logo téléversé");
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (values: BrandingValues) => {
    setPreview(values);
    toast.success("Identité visuelle mise à jour");
  };

  return (
    <div className="grid grid-cols-2 gap-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 col-span-1">
          <FormItem>
            <FormLabel>Logo</FormLabel>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <label htmlFor="logo-upload" className="cursor-pointer text-sm text-blue-600">
                Click to upload
              </label>
            </div>
          </FormItem>

          <FormField
            control={form.control}
            name="orgName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Organization name"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      setPreview((prev) => ({ ...prev, orgName: e.target.value }));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="primaryColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Color</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      type="color"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setPreview((prev) => ({ ...prev, primaryColor: e.target.value }));
                      }}
                      className="h-10 w-16"
                    />
                  </FormControl>
                  <FormControl>
                    <Input
                      placeholder="#000000"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setPreview((prev) => ({ ...prev, primaryColor: e.target.value }));
                      }}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full">
            Save Branding
          </Button>
        </form>
      </Form>

      <div className="col-span-1 flex items-center justify-center">
        <div
          className="border rounded-lg p-6 w-full max-w-xs"
          style={{ borderColor: preview.primaryColor }}
        >
          <img
            src={logoUrl}
            alt="Logo preview"
            className="w-24 h-24 object-contain mx-auto mb-4"
          />
          <h2 className="text-xl font-bold text-center" style={{ color: preview.primaryColor }}>
            {preview.orgName}
          </h2>
          <p className="text-sm text-gray-500 text-center mt-2">Preview Card</p>
        </div>
      </div>
    </div>
  );
}
