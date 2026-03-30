"use client";

import { useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface PhotoItem {
  id: string;
  url: string;
}

interface InterventionReportProps {
  interventionId?: string;
  onSubmit?: (report: InterventionReportData) => void;
  initialData?: Partial<InterventionReportData>;
}

export interface InterventionReportData {
  interventionType: string;
  location: string;
  date: string;
  description: string;
  photos: PhotoItem[];
  signatureUrl?: string;
}

export function InterventionReport({
  interventionId,
  onSubmit,
  initialData = {},
}: InterventionReportProps) {
  const [formData, setFormData] = useState<InterventionReportData>({
    interventionType: "",
    location: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    photos: [],
    ...initialData,
  });

  const [signaturePad, setSignaturePad] = useState<HTMLCanvasElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleFieldChange = (field: keyof InterventionReportData, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePhotoAdd = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const photoUrl = e.target?.result as string;
      setFormData((prev) => ({
        ...prev,
        photos: [...prev.photos, { id: `photo-${Date.now()}`, url: photoUrl }],
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (photoId: string) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
    }));
  };

  const handleSignatureCapture = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData((prev) => ({
        ...prev,
        signatureUrl: e.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Trigger browser print dialog as the PDF export mechanism
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const isFormValid =
    formData.interventionType &&
    formData.location &&
    formData.date &&
    formData.description;

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
        <h1 className="text-2xl font-bold">Intervention Report</h1>
        {interventionId && (
          <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">ID: {interventionId}</p>
        )}
      </Card>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Intervention Type */}
        <Card className="p-4">
          <label className="block text-sm font-medium mb-2">Intervention Type</label>
          <select
            value={formData.interventionType}
            onChange={(e) => handleFieldChange("interventionType", e.target.value)}
            className="w-full px-3 py-2 border rounded bg-card dark:bg-gray-900 dark:border-gray-700"
          >
            <option value="">Select type...</option>
            <option value="maintenance">Maintenance</option>
            <option value="repair">Repair</option>
            <option value="inspection">Inspection</option>
            <option value="emergency">Emergency</option>
          </select>
        </Card>

        {/* Date */}
        <Card className="p-4">
          <label className="block text-sm font-medium mb-2">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => handleFieldChange("date", e.target.value)}
            className="w-full px-3 py-2 border rounded bg-card dark:bg-gray-900 dark:border-gray-700"
          />
        </Card>

        {/* Location - Full Width */}
        <Card className="p-4 md:col-span-2">
          <label className="block text-sm font-medium mb-2">Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => handleFieldChange("location", e.target.value)}
            placeholder="Site address or coordinates..."
            className="w-full px-3 py-2 border rounded bg-card dark:bg-gray-900 dark:border-gray-700"
          />
        </Card>

        {/* Description - Full Width */}
        <Card className="p-4 md:col-span-2">
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleFieldChange("description", e.target.value)}
            placeholder="Detailed description of the intervention..."
            rows={4}
            className="w-full px-3 py-2 border rounded bg-card dark:bg-gray-900 dark:border-gray-700"
          />
        </Card>
      </div>

      {/* Photos Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Photos</h2>
          <label>
            <Button variant="outline" size="sm" asChild>
              <div className="cursor-pointer flex items-center gap-2">
                <Plus className="size-4" />
                Add Photo
              </div>
            </Button>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handlePhotoAdd(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </label>
        </div>

        {formData.photos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {formData.photos.map((photo) => (
              <div key={photo.id} className="relative group aspect-square rounded border overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt="Intervention photo"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemovePhoto(photo.id)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                >
                  <Trash2 className="size-5 text-white" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
            <p>No photos added yet</p>
          </div>
        )}
      </Card>

      {/* Signature Pad Placeholder */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Signature</h2>
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          {formData.signatureUrl ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={formData.signatureUrl} alt="Signature" className="h-20 border rounded p-2" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFieldChange("signatureUrl", undefined)}
              >
                Clear Signature
              </Button>
            </div>
          ) : (
            <label>
              <Button variant="outline" asChild>
                <div className="cursor-pointer">Capture Signature</div>
              </Button>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleSignatureCapture(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </label>
          )}
        </div>
      </Card>

      {/* Action Buttons */}
      <Card className="p-4 flex gap-3 sticky bottom-6">
        <Button
          onClick={() => onSubmit?.(formData)}
          disabled={!isFormValid}
          className="flex-1"
        >
          Submit Report
        </Button>
        <Button
          onClick={handleExportPDF}
          disabled={!isFormValid || isExporting}
          variant="outline"
          className="flex-1"
        >
          <Download className="size-4 mr-2" />
          {isExporting ? "Exporting..." : "Export PDF"}
        </Button>
      </Card>
    </div>
  );
}
