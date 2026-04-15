"use client";

import { useState } from "react";
import { Palette, Type, MessageSquare, Check, X } from "lucide-react";

interface ColorItem {
  name: string;
  hex: string;
  usage: string;
}

interface TypefaceItem {
  name: string;
  family: string;
  weights: string[];
  usage: string;
}

interface GuidelineItem {
  id: string;
  text: string;
  category: "do" | "dont";
}

const COLORS: ColorItem[] = [
  { name: "Primary Blue", hex: "#0066CC", usage: "Primary CTA, headers" },
  {
    name: "Secondary Green",
    hex: "#00AA66",
    usage: "Success states, positive actions",
  },
  { name: "Accent Orange", hex: "#FF9900", usage: "Warnings, highlights" },
  { name: "Dark Gray", hex: "#333333", usage: "Body text, dark backgrounds" },
  { name: "Light Gray", hex: "#F5F5F5", usage: "Backgrounds, disabled states" },
  { name: "Error Red", hex: "#EE3333", usage: "Errors, critical information" },
];

const TYPEFACES: TypefaceItem[] = [
  {
    name: "Inter",
    family: "Inter, sans-serif",
    weights: ["400", "500", "600", "700"],
    usage: "Body text, UI elements",
  },
  {
    name: "Poppins",
    family: "Poppins, sans-serif",
    weights: ["600", "700", "800"],
    usage: "Headlines, titles",
  },
];

const TONE_GUIDELINES = [
  "Professional yet approachable",
  "Clear and concise communication",
  "Positive and action-oriented language",
  "Avoid jargon when possible",
  "Show empathy in error messages",
];

const DO_DONTS: GuidelineItem[] = [
  {
    id: "1",
    text: "Use consistent spacing (8px grid system)",
    category: "do",
  },
  {
    id: "2",
    text: "Keep line-height at 1.5 for body text",
    category: "do",
  },
  {
    id: "3",
    text: "Use primary blue for main CTAs",
    category: "do",
  },
  {
    id: "4",
    text: "Use brand colors in isolation (no color mixing)",
    category: "dont",
  },
  {
    id: "5",
    text: "Use more than 3 font weights in design",
    category: "dont",
  },
  {
    id: "6",
    text: "Stretch or distort logos",
    category: "dont",
  },
];

export function BrandGuidelines() {
  const [activeTab, setActiveTab] = useState<
    "colors" | "typography" | "tone" | "guidelines"
  >("colors");

  const dos = DO_DONTS.filter((item) => item.category === "do");
  const donts = DO_DONTS.filter((item) => item.category === "dont");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Palette className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Brand Guidelines
          </h2>
          <p className="text-muted-foreground">
            Visual identity and communication standards
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b flex gap-1 bg-card rounded-lg p-1">
        <button
          onClick={() => setActiveTab("colors")}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === "colors"
              ? "bg-blue-100 text-blue-900"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Palette className="w-4 h-4 inline mr-2" />
          Colors
        </button>
        <button
          onClick={() => setActiveTab("typography")}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === "typography"
              ? "bg-blue-100 text-blue-900"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Type className="w-4 h-4 inline mr-2" />
          Typography
        </button>
        <button
          onClick={() => setActiveTab("tone")}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === "tone"
              ? "bg-blue-100 text-blue-900"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Tone
        </button>
        <button
          onClick={() => setActiveTab("guidelines")}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === "guidelines"
              ? "bg-blue-100 text-blue-900"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Do&apos;s & Don&apos;ts
        </button>
      </div>

      {/* Colors Tab */}
      {activeTab === "colors" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COLORS.map((color) => (
              <div key={color.name} className="border rounded-lg p-6 bg-card">
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-20 h-20 rounded-lg border-2 border-border"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div>
                    <p className="font-semibold text-foreground">
                      {color.name}
                    </p>
                    <p className="font-mono text-sm text-muted-foreground">
                      {color.hex}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {color.usage}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Typography Tab */}
      {activeTab === "typography" && (
        <div className="space-y-6">
          {TYPEFACES.map((typeface) => (
            <div key={typeface.name} className="border rounded-lg p-6 bg-card">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {typeface.name}
              </h3>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground font-medium mb-2">
                  Family
                </p>
                <p className="font-mono text-sm text-foreground">
                  {typeface.family}
                </p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground font-medium mb-2">
                  Available Weights
                </p>
                <div className="flex flex-wrap gap-3">
                  {typeface.weights.map((weight) => (
                    <div key={weight} className="bg-muted rounded p-3">
                      <p
                        className="text-center"
                        style={{
                          fontFamily: typeface.family,
                          fontWeight: weight as number | string,
                        }}
                      >
                        {weight}
                      </p>
                      <p className="text-xs text-muted-foreground text-center mt-1">
                        The quick brown fox
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Usage
                </p>
                <p className="text-foreground">{typeface.usage}</p>
              </div>
            </div>
          ))}

          <div className="border rounded-lg p-6 bg-card space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              Typography Hierarchy
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">
                  H1 - Page Title
                </p>
                <p
                  className="text-3xl font-bold"
                  style={{ fontFamily: "Poppins" }}
                >
                  Main Headline Goes Here
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">
                  H2 - Section Title
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: "Poppins" }}
                >
                  Section Headline
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">
                  Body - Regular Text
                </p>
                <p
                  className="text-base"
                  style={{ fontFamily: "Inter", lineHeight: 1.5 }}
                >
                  This is body text. It should be clear, readable, and
                  accessible. Use proper line-height and spacing for optimal
                  readability.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tone Tab */}
      {activeTab === "tone" && (
        <div className="space-y-6">
          <div className="border rounded-lg p-6 bg-card space-y-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Tone of Voice
            </h3>
            <div className="space-y-3">
              {TONE_GUIDELINES.map((guideline, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-blue-50"
                >
                  <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <p className="text-foreground">{guideline}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-6 bg-card space-y-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Writing Examples
            </h3>
            <div className="space-y-4">
              <div className="border-l-4 border-green-400 pl-4">
                <p className="text-sm text-muted-foreground font-medium mb-1">
                  Good
                </p>
                <p className="text-foreground">
                  "Your account has been created successfully. You can now start
                  using SignApps."
                </p>
              </div>
              <div className="border-l-4 border-red-400 pl-4">
                <p className="text-sm text-muted-foreground font-medium mb-1">
                  Avoid
                </p>
                <p className="text-foreground">
                  "ERROR: Account initialization process completed with positive
                  status code 200."
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guidelines Tab */}
      {activeTab === "guidelines" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Do&apos;s
            </h3>
            <div className="space-y-3">
              {dos.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200"
                >
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <X className="w-5 h-5 text-red-600" />
              Don&apos;ts
            </h3>
            <div className="space-y-3">
              {donts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200"
                >
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                  <p className="text-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
