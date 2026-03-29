"use client";

import { useState } from "react";
import { Search, Plus, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

interface QAItem {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  author: string;
  date: Date;
}

const askQuestionSchema = z.object({
  question: z.string().min(10, "Question must be at least 10 characters"),
  category: z.string().min(1, "Please select a category"),
});

type AskQuestionValues = z.infer<typeof askQuestionSchema>;

export function QAKnowledgeBase() {
  const [qa, setQa] = useState<QAItem[]>([
    {
      id: "1",
      question: "How do I reset my password?",
      answer: "Go to Settings > Security > Password. Click Change Password and follow the prompts.",
      tags: ["account", "security"],
      author: "Admin",
      date: new Date(Date.now() - 86400000),
    },
    {
      id: "2",
      question: "What are the system requirements?",
      answer: "SignApps requires a modern browser and stable internet connection. Minimum 2GB RAM recommended.",
      tags: ["system", "requirements"],
      author: "Support Team",
      date: new Date(Date.now() - 172800000),
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const form = useForm<AskQuestionValues>({
    resolver: zodResolver(askQuestionSchema),
    defaultValues: {
      question: "",
      category: "",
    },
  });

  const filteredQA = qa.filter((item) =>
    item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const onSubmit = (values: AskQuestionValues) => {
    const newQA: QAItem = {
      id: Date.now().toString(),
      question: values.question,
      answer: "Pending moderation by support team...",
      tags: [values.category],
      author: "You",
      date: new Date(),
    };
    setQa([newQA, ...qa]);
    form.reset();
    setShowForm(false);
    toast.success("Question soumise pour révision");
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Ask Question
        </Button>
      </div>

      {showForm && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="border rounded-lg p-4 bg-blue-50 space-y-4">
            <h3 className="font-semibold text-blue-900">Ask a Question</h3>

            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Question</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ask your question clearly and concisely..."
                      className="min-h-20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="account">Account</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Submit Question
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowForm(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      )}

      <div className="space-y-2">
        {filteredQA.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No Q&A found. Try a different search term.</p>
        ) : (
          filteredQA.map((item) => (
            <div
              key={item.id}
              className="border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <button
                onClick={() => toggleExpand(item.id)}
                className="w-full text-left p-4 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base break-words">{item.question}</p>
                  <div className="flex gap-2 items-center mt-2 flex-wrap">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {item.author} · {item.date.toLocaleDateString()}
                  </p>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                    expandedId === item.id ? "rotate-180" : ""
                  }`}
                />
              </button>

              {expandedId === item.id && (
                <div className="border-t bg-gray-50 p-4 text-sm">
                  <p className="text-gray-700">{item.answer}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
