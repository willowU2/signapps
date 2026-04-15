"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const watermarkSchema = z.object({
  text: z.string().min(1, "Watermark text is required").max(100),
  position: z.enum([
    "center",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ]),
  opacity: z.number().min(0).max(100),
});

type WatermarkValues = z.infer<typeof watermarkSchema>;

export function WatermarkConfig() {
  const [preview, setPreview] = useState({
    text: "CONFIDENTIAL",
    position: "center",
    opacity: 30,
  });

  const form = useForm<WatermarkValues>({
    resolver: zodResolver(watermarkSchema),
    defaultValues: {
      text: "CONFIDENTIAL",
      position: "center",
      opacity: 30,
    },
  });

  const onSubmit = (values: WatermarkValues) => {
    setPreview({
      text: values.text,
      position: values.position,
      opacity: values.opacity,
    });
    toast.success("Paramètres du filigrane mis à jour");
  };

  const getPositionClass = () => {
    const baseClass =
      "absolute text-2xl font-bold text-gray-400 select-none pointer-events-none";
    const positionClasses = {
      center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
      "top-left": "top-4 left-4",
      "top-right": "top-4 right-4",
      "bottom-left": "bottom-4 left-4",
      "bottom-right": "bottom-4 right-4",
    };
    return `${baseClass} ${positionClasses[preview.position as keyof typeof positionClasses]}`;
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Watermark Text</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter watermark text"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      setPreview((prev) => ({ ...prev, text: e.target.value }));
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Position</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setPreview((prev) => ({
                      ...prev,
                      position: value as WatermarkValues["position"],
                    }));
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="opacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opacity: {field.value}%</FormLabel>
                <FormControl>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={field.value}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      field.onChange(val);
                      setPreview((prev) => ({ ...prev, opacity: val }));
                    }}
                    className="w-full"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full">
            Apply Watermark
          </Button>
        </form>
      </Form>

      <div className="border rounded-lg p-8 bg-muted relative overflow-hidden min-h-64 flex items-center justify-center">
        <div
          className={getPositionClass()}
          style={{ opacity: preview.opacity / 100 }}
        >
          {preview.text}
        </div>
        <p className="text-sm text-muted-foreground text-center">Preview</p>
      </div>
    </div>
  );
}
