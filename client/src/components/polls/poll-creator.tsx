"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";

export type PollType = "single" | "multiple";

export interface PollOption {
  id: string;
  text: string;
}

export interface PollData {
  question: string;
  type: PollType;
  options: PollOption[];
}

interface PollCreatorProps {
  onSubmit: (poll: PollData) => void;
  onCancel?: () => void;
}

export function PollCreator({ onSubmit, onCancel }: PollCreatorProps) {
  const [question, setQuestion] = useState("");
  const [type, setType] = useState<PollType>("single");
  const [options, setOptions] = useState<PollOption[]>([
    { id: "1", text: "" },
    { id: "2", text: "" },
  ]);

  const handleAddOption = () => {
    const newId = Math.max(...options.map((o) => parseInt(o.id) || 0), 0) + 1;
    setOptions([...options, { id: String(newId), text: "" }]);
  };

  const handleRemoveOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter((o) => o.id !== id));
    }
  };

  const handleOptionChange = (id: string, text: string) => {
    setOptions(options.map((o) => (o.id === id ? { ...o, text } : o)));
  };

  const isValid =
    question.trim().length > 0 &&
    options.filter((o) => o.text.trim().length > 0).length >= 2;

  const handleSubmit = () => {
    if (!isValid) return;

    onSubmit({
      question: question.trim(),
      type,
      options: options.filter((o) => o.text.trim().length > 0),
    });
  };

  return (
    <Card className="w-full max-w-2xl p-6 space-y-4">
      <h2 className="text-xl font-semibold">Create a Poll</h2>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Question</label>
        <Input
          placeholder="What is your question?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Poll Type</label>
        <Select value={type} onValueChange={(v) => setType(v as PollType)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single Choice</SelectItem>
            <SelectItem value="multiple">Multiple Choice</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Options</label>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <Input
                placeholder={`Option ${index + 1}`}
                value={option.text}
                onChange={(e) => handleOptionChange(option.id, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveOption(option.id)}
                disabled={options.length <= 2}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleAddOption}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Option
        </Button>
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={!isValid} className="flex-1">
          Create Poll
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
