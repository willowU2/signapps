'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Mail, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  category?: 'Facturation' | 'Support' | 'Commercial' | 'RH';
  preview: string;
}

interface MailClassifierProps {
  emails?: EmailItem[];
  onCategoryChange?: (emailId: string, category: string) => void;
}

const CATEGORIES = ['Facturation', 'Support', 'Commercial', 'RH'] as const;

const categoryColors: Record<string, string> = {
  Facturation: 'bg-blue-100 text-blue-800',
  Support: 'bg-green-100 text-green-800',
  Commercial: 'bg-purple-100 text-purple-800',
  RH: 'bg-orange-100 text-orange-800',
};

export function MailClassifier({ emails = [], onCategoryChange }: MailClassifierProps) {
  const [items, setItems] = useState<EmailItem[]>(emails);
  const [isClassifying, setIsClassifying] = useState(false);

  const classifyInbox = async () => {
    setIsClassifying(true);
    try {
      // Simulate AI classification
      const classified = items.map((email) => {
        const categoryIndex = Math.floor(Math.random() * CATEGORIES.length);
        return {
          ...email,
          category: CATEGORIES[categoryIndex],
        };
      });
      setItems(classified);
      toast.success(`Classified ${items.length} emails`);
    } catch (error) {
      toast.error('Failed to classify emails');
    } finally {
      setIsClassifying(false);
    }
  };

  const updateCategory = (emailId: string, category: (typeof CATEGORIES)[number]) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === emailId ? { ...item, category } : item
      )
    );
    onCategoryChange?.(emailId, category);
    toast.success('Category updated');
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Classifier
        </CardTitle>
        <Button
          onClick={classifyInbox}
          disabled={isClassifying || items.length === 0}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isClassifying ? 'animate-spin' : ''}`} />
          Auto-Classify
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No emails to classify</p>
          ) : (
            items.map((email) => (
              <div
                key={email.id}
                className="p-3 border rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{email.subject}</p>
                    <p className="text-xs text-muted-foreground">{email.from}</p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    {email.category && (
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${categoryColors[email.category]}`}>
                        {email.category}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{email.preview}</p>
                {!email.category && (
                  <div className="flex gap-1 flex-wrap">
                    {CATEGORIES.map((cat) => (
                      <Button
                        key={cat}
                        variant="ghost"
                        size="xs"
                        className="h-6 text-xs"
                        onClick={() => updateCategory(email.id, cat)}
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
