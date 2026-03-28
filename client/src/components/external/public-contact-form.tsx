"use client";

import React, { useState } from "react";
import { Mail, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface PublicContactFormProps {
  organizationId?: string;
  apiBaseUrl?: string;
  onSuccess?: (data: ContactFormData) => void;
}

export function PublicContactForm({
  organizationId = "default",
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.signapps.local",
  onSuccess,
}: PublicContactFormProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const embedCode = `<iframe
  src="${apiBaseUrl}/contact/${organizationId}"
  width="100%"
  height="600"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
></iframe>`;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/contact/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          organizationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit form");
      }

      setIsSuccess(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
      onSuccess?.(formData);
      toast.success("Message envoyé avec succès !");

      setTimeout(() => setIsSuccess(false), 4000);
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    toast.success("Embed code copied!");
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Contact Form Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-t-lg">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <CardTitle>Contact Us</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isSuccess ? (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                  Message Sent!
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Thank you for your message. We'll get back to you soon.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  name="subject"
                  type="text"
                  placeholder="How can we help?"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="Your message..."
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  disabled={isLoading}
                  rows={5}
                  className="resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? "Sending..." : "Send Message"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Embed Code Card */}
      <Card className="border-0 shadow-lg bg-gray-50 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base">Embed This Form</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Copy the code below to embed this contact form on your website
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
              <code>{embedCode}</code>
            </pre>
            <Button
              onClick={copyEmbedCode}
              size="sm"
              variant="outline"
              className="absolute top-3 right-3 bg-white dark:bg-gray-800"
            >
              {copiedEmbed ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PublicContactForm;
