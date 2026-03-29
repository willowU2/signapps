"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface FAQManagerProps {
  onSave?: (faqs: FAQItem[]) => void;
}

export function FAQManager({ onSave }: FAQManagerProps) {
  const [faqs, setFaqs] = useState<FAQItem[]>([
    {
      id: "1",
      category: "General",
      question: "What is SignApps?",
      answer: "SignApps is a secure, open-source alternative to Google Workspace.",
    },
    {
      id: "2",
      category: "General",
      question: "Is SignApps free?",
      answer: "Yes, SignApps is completely free and open-source.",
    },
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    "General"
  );
  const [formData, setFormData] = useState({
    category: "",
    question: "",
    answer: "",
  });

  const categories = Array.from(new Set(faqs.map((f) => f.category)));
  const filteredFaqs = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddClick = () => {
    setEditingId("new");
    setFormData({ category: "", question: "", answer: "" });
  };

  const handleEditClick = (faq: FAQItem) => {
    setEditingId(faq.id);
    setFormData({
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
    });
  };

  const handleSave = () => {
    if (!formData.category.trim() || !formData.question.trim() || !formData.answer.trim()) {
      toast.error("Tous les champs sont obligatoires");
      return;
    }

    if (editingId === "new") {
      const newFaq: FAQItem = {
        id: `f${Date.now()}`,
        category: formData.category,
        question: formData.question,
        answer: formData.answer,
      };
      setFaqs([...faqs, newFaq]);
      toast.success("FAQ added successfully");
    } else {
      setFaqs(
        faqs.map((f) =>
          f.id === editingId
            ? {
                ...f,
                category: formData.category,
                question: formData.question,
                answer: formData.answer,
              }
            : f
        )
      );
      toast.success("FAQ updated successfully");
    }

    setEditingId(null);
    setFormData({ category: "", question: "", answer: "" });
    onSave?.(faqs);
  };

  const handleDelete = (id: string) => {
    setFaqs(faqs.filter((f) => f.id !== id));
    toast.success("FAQ deleted");
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ category: "", question: "", answer: "" });
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Form */}
      {editingId && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId === "new" ? "Add New FAQ" : "Edit FAQ"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                placeholder="e.g., General, Technical, Pricing"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="question">Question *</Label>
              <Input
                id="question"
                placeholder="Enter the question..."
                value={formData.question}
                onChange={(e) =>
                  setFormData({ ...formData, question: e.target.value })
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="answer">Answer *</Label>
              <Textarea
                id="answer"
                placeholder="Enter the answer..."
                value={formData.answer}
                onChange={(e) =>
                  setFormData({ ...formData, answer: e.target.value })
                }
                className="mt-2 resize-none"
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                {editingId === "new" ? "Add FAQ" : "Update FAQ"}
              </Button>
              <Button onClick={handleCancel} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQ List by Category */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            No FAQs yet. Click "Add FAQ" to create one.
          </CardContent>
        </Card>
      ) : (
        categories.map((category) => (
          <Card key={category}>
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() =>
                setExpandedCategory(
                  expandedCategory === category ? null : category
                )
              }
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{category}</CardTitle>
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${
                    expandedCategory === category ? "rotate-180" : ""
                  }`}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {faqs.filter((f) => f.category === category).length} items
              </p>
            </CardHeader>

            {expandedCategory === category && (
              <CardContent className="space-y-4 border-t pt-4">
                {filteredFaqs
                  .filter((f) => f.category === category)
                  .map((faq) => (
                    <div
                      key={faq.id}
                      className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white mb-2">
                            {faq.question}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {faq.answer}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            onClick={() => handleEditClick(faq)}
                            size="sm"
                            variant="ghost"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(faq.id)}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                {filteredFaqs.filter((f) => f.category === category).length ===
                  0 && (
                  <p className="text-center text-gray-400 text-sm">
                    No matching FAQs in this category
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        ))
      )}

      {/* Add FAQ Button */}
      {!editingId && (
        <Button
          onClick={handleAddClick}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add FAQ
        </Button>
      )}
    </div>
  );
}

export default FAQManager;
