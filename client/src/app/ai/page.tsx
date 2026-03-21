'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Send, Bot, User, FileText, Plus, Upload, Search, RefreshCw, Cpu, Server, Cloud, MessageSquare, Trash2, Edit3, MoreVertical, Download, Database, FolderPlus, HardDrive, Clock, ChevronLeft, ChevronRight, Languages, Settings } from 'lucide-react';
import { aiApi, AIStats, Model, ProviderInfo, KnowledgeBase } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { DocumentUpload } from '@/components/ai/document-upload';
import { VoiceChatButton } from '@/components/ai/voice-chat-button';
import { useVoiceChat } from '@/hooks/use-voice-chat';
import { ModelManagement } from '@/components/ai/model-management';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';

// Types for conversations
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { filename: string; page?: number; score?: number }[];
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  knowledgeBases?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// LocalStorage keys
const CONVERSATIONS_KEY = 'signapps_ai_conversations';
const ACTIVE_CONVERSATION_KEY = 'signapps_ai_active_conversation';
const LANGUAGE_KEY = 'signapps_ai_language';
const SYSTEM_PROMPT_KEY = 'signapps_ai_system_prompt';

const LANGUAGES = [
  { code: 'fr', label: 'Francais' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Espanol' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Portugues' },
] as const;

// Helper functions for localStorage
function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(CONVERSATIONS_KEY);
    if (!data) return [];
    const conversations = JSON.parse(data);
    return conversations.map((c: Conversation) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      messages: c.messages.map((m: Message) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    }));
  } catch {
    return [];
  }
}

function saveConversations(conversations: Conversation[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

function loadActiveConversationId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_CONVERSATION_KEY);
}

function saveActiveConversationId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  }
}

function generateConversationTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const title = firstUserMessage.content.slice(0, 50);
    return title.length < firstUserMessage.content.length ? `${title}...` : title;
  }
  return 'Nouvelle conversation';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Hier';
  } else if (days < 7) {
    return date.toLocaleDateString('fr-FR', { weekday: 'long' });
  } else {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
}

export default function AIPage() {
  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Current conversation messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // AI stats and models
  const [stats, setStats] = useState<AIStats | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(true);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  // Knowledge bases
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<string[]>([]);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);

  // Dialogs
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createKbDialogOpen, setCreateKbDialogOpen] = useState(false);
  const [deleteKbDialogOpen, setDeleteKbDialogOpen] = useState(false);

  // Dialog state
  const [conversationToRename, setConversationToRename] = useState<Conversation | null>(null);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [kbToDelete, setKbToDelete] = useState<KnowledgeBase | null>(null);
  const [newConversationTitle, setNewConversationTitle] = useState('');
  const [newKbName, setNewKbName] = useState('');
  const [newKbDescription, setNewKbDescription] = useState('');

  // Language & system prompt
  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr');
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>('');
  const [systemPromptDialogOpen, setSystemPromptDialogOpen] = useState(false);
  const [tempSystemPrompt, setTempSystemPrompt] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge' | 'models'>('chat');

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedRef = useRef('');

  // Load conversations from localStorage on mount
  useEffect(() => {
    const loaded = loadConversations();
    setConversations(loaded);

    const activeId = loadActiveConversationId();
    if (activeId && loaded.find(c => c.id === activeId)) {
      setActiveConversationId(activeId);
      const active = loaded.find(c => c.id === activeId);
      if (active) {
        setMessages(active.messages);
        setSelectedKnowledgeBases(active.knowledgeBases || []);
      }
    }

    // Load persisted settings to fix Hydration mismatch
    const lang = localStorage.getItem(LANGUAGE_KEY);
    if (lang) setSelectedLanguage(lang);
    
    const sysPrompt = localStorage.getItem(SYSTEM_PROMPT_KEY);
    if (sysPrompt) setCustomSystemPrompt(sysPrompt);
  }, []);

  // Save conversations when they change
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations]);

  // Save active conversation ID
  useEffect(() => {
    saveActiveConversationId(activeConversationId);
  }, [activeConversationId]);

  // Persist language preference
  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, selectedLanguage);
  }, [selectedLanguage]);

  // Persist custom system prompt
  useEffect(() => {
    if (customSystemPrompt) {
      localStorage.setItem(SYSTEM_PROMPT_KEY, customSystemPrompt);
    } else {
      localStorage.removeItem(SYSTEM_PROMPT_KEY);
    }
  }, [customSystemPrompt]);

  // Update conversation messages when they change
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      setConversations(prev => prev.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            messages,
            title: c.title === 'Nouvelle conversation' ? generateConversationTitle(messages) : c.title,
            updatedAt: new Date(),
          };
        }
        return c;
      }));
    }
  }, [messages, activeConversationId]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await aiApi.stats();
      setStats(response.data);
    } catch {
      setStats({
        documents_count: 0,
        chunks_count: 0,
        last_indexed: undefined,
      });
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    try {
      const response = await aiApi.providers();
      const providerList = response.data.providers || [];
      const activeProvider = response.data.active_provider;
      setProviders(providerList);
      setSelectedProvider(prev => {
        if (prev) return prev; // keep user selection
        const defaultProvider = providerList.find(p => p.id === activeProvider && p.enabled)
          || providerList.find(p => p.enabled);
        if (defaultProvider) {
          setSelectedModel(curr => curr || defaultProvider.default_model);
          return defaultProvider.id;
        }
        return prev;
      });
    } catch {
      setProviders([{
        id: 'ollama',
        name: 'Ollama (Local)',
        provider_type: 'ollama',
        enabled: true,
        default_model: 'llama3.2:3b',
        is_local: true,
      }]);
      setSelectedProvider(prev => prev || 'ollama');
    }
  }, []);

  const fetchModels = useCallback(async (providerId: string, providersList: ProviderInfo[]) => {
    if (!providerId) return;
    setLoadingModels(true);
    try {
      const response = await aiApi.models(providerId);
      const modelList = response.data.models || [];
      setModels(modelList);
      // Only auto-select if current model is not in the list
      setSelectedModel(prev => {
        if (prev && modelList.some(m => m.id === prev)) return prev;
        const provider = providersList.find(p => p.id === providerId);
        if (provider && modelList.some(m => m.id === provider.default_model)) {
          return provider.default_model;
        }
        return modelList.length > 0 ? modelList[0].id : prev;
      });
    } catch {
      const provider = providersList.find(p => p.id === providerId);
      if (provider) {
        setModels([{ id: provider.default_model, name: provider.default_model }]);
        setSelectedModel(prev => prev || provider.default_model);
      } else {
        setModels([{ id: 'default', name: 'Default Model' }]);
        setSelectedModel(prev => prev || 'default');
      }
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const fetchKnowledgeBases = useCallback(async () => {
    setLoadingKnowledgeBases(true);
    try {
      const response = await aiApi.listCollections();
      setKnowledgeBases(response.data.collections || []);
    } catch {
      setKnowledgeBases([]);
    } finally {
      setLoadingKnowledgeBases(false);
    }
  }, []);

  // Initial data fetch — run once on mount
  useEffect(() => {
    fetchStats();
    fetchProviders();
    fetchKnowledgeBases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch models when provider changes
  useEffect(() => {
    if (selectedProvider) {
      fetchModels(selectedProvider, providers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const createNewChat = useCallback(() => {
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      title: 'Nouvelle conversation',
      messages: [{
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Bonjour ! Je suis votre assistant IA. Je peux vous aider a rechercher et comprendre vos documents. Que souhaitez-vous savoir ?',
        timestamp: new Date(),
      }],
      knowledgeBases: selectedKnowledgeBases.length > 0 ? selectedKnowledgeBases : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setMessages(newConversation.messages);
  }, [selectedKnowledgeBases]);

  const selectConversation = useCallback((conversation: Conversation) => {
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
    setSelectedKnowledgeBases(conversation.knowledgeBases || []);
    setActiveTab('chat');
  }, []);

  const handleRenameConversation = useCallback(() => {
    if (!conversationToRename || !newConversationTitle.trim()) return;

    setConversations(prev => prev.map(c => {
      if (c.id === conversationToRename.id) {
        return { ...c, title: newConversationTitle.trim(), updatedAt: new Date() };
      }
      return c;
    }));

    setRenameDialogOpen(false);
    setConversationToRename(null);
    setNewConversationTitle('');
    toast.success('Conversation renommee');
  }, [conversationToRename, newConversationTitle]);

  const handleDeleteConversation = useCallback(() => {
    if (!conversationToDelete) return;

    setConversations(prev => prev.filter(c => c.id !== conversationToDelete.id));

    if (activeConversationId === conversationToDelete.id) {
      setActiveConversationId(null);
      setMessages([]);
    }

    setDeleteDialogOpen(false);
    setConversationToDelete(null);
    toast.success('Conversation supprimee');
  }, [conversationToDelete, activeConversationId]);

  const handleCreateKnowledgeBase = useCallback(async () => {
    if (!newKbName.trim()) return;

    try {
      await aiApi.createCollection({
        name: newKbName.trim(),
        description: newKbDescription.trim() || undefined,
      });

      await fetchKnowledgeBases();
      setCreateKbDialogOpen(false);
      setNewKbName('');
      setNewKbDescription('');
      toast.success('Knowledge base creee');
    } catch {
      toast.error('Erreur lors de la creation');
    }
  }, [newKbName, newKbDescription, fetchKnowledgeBases]);

  const handleDeleteKnowledgeBase = useCallback(async () => {
    if (!kbToDelete) return;

    try {
      await aiApi.deleteCollection(kbToDelete.name);
      await fetchKnowledgeBases();

      if (selectedKnowledgeBases.includes(kbToDelete.name)) {
        setSelectedKnowledgeBases(prev => prev.filter(n => n !== kbToDelete!.name));
      }

      setDeleteKbDialogOpen(false);
      setKbToDelete(null);
      toast.success('Knowledge base supprimee');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  }, [kbToDelete, selectedKnowledgeBases, fetchKnowledgeBases]);

  const exportConversation = useCallback(() => {
    if (messages.length === 0) return;

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const title = activeConversation?.title || 'conversation';

    let markdown = `# ${title}\n\n`;
    markdown += `*Exporte le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}*\n\n`;

    if (selectedKnowledgeBases && selectedKnowledgeBases.length > 0) {
      markdown += `**Knowledge Bases:** ${selectedKnowledgeBases.join(', ')}\n\n`;
    }

    markdown += '---\n\n';

    messages.forEach(message => {
      const role = message.role === 'user' ? 'Vous' : 'Assistant';
      markdown += `### ${role}\n\n`;
      markdown += `${message.content}\n\n`;

      if (message.sources && message.sources.length > 0) {
        markdown += '**Sources:**\n';
        message.sources.forEach(source => {
          markdown += `- ${source.filename}`;
          if (source.score) {
            markdown += ` (${(source.score * 100).toFixed(0)}%)`;
          }
          markdown += '\n';
        });
        markdown += '\n';
      }
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Conversation exportee');
  }, [messages, conversations, activeConversationId, selectedKnowledgeBases]);

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || input.trim();
    if (!text || isLoading) return;

    // Create new conversation if none active
    if (!activeConversationId) {
      createNewChat();
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!textOverride) setInput('');
    setIsLoading(true);
    accumulatedRef.current = '';

    // Create a placeholder assistant message for streaming
    const assistantMessageId = crypto.randomUUID();

    // Create AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Try streaming first with native fetch
      const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';

      const streamResponse = await fetch(`${AI_URL}/ai/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: text,
          model: selectedModel || undefined,
          provider: selectedProvider || undefined,
          collections: selectedKnowledgeBases.length > 0 ? selectedKnowledgeBases : undefined,
          language: selectedLanguage || undefined,
          system_prompt: customSystemPrompt || undefined,
        }),
        signal: controller.signal,
      });

      if (streamResponse.ok && streamResponse.body) {
        // Add empty assistant message that we'll stream into
        setMessages(prev => [...prev, {
          id: assistantMessageId,
          role: 'assistant' as const,
          content: '',
          timestamp: new Date(),
        }]);

        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.token || parsed.content || parsed.text) {
                    accumulatedRef.current +=
                      parsed.token || parsed.content || parsed.text || '';
                    setMessages(prev => prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: accumulatedRef.current }
                        : m
                    ));
                  }
                  if (parsed.sources) {
                    setMessages(prev => prev.map(m =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            sources: parsed.sources.map(
                              (s: { filename: string; score?: number }) => ({
                                filename: s.filename,
                                score: s.score,
                              })
                            ),
                          }
                        : m
                    ));
                  }
                } catch {
                  // If not JSON, treat as plain text token
                  accumulatedRef.current += data;
                  setMessages(prev => prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: accumulatedRef.current }
                      : m
                  ));
                }
              }
            }
          }
        } catch (err) {
          // AbortError means the user interrupted — keep partial text
          if (err instanceof DOMException && err.name === 'AbortError') {
            // Partial text is already in the message via accumulatedRef
          } else {
            throw err;
          }
        }

        // If we got no content from streaming, remove the empty message
        if (!accumulatedRef.current) {
          setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
          throw new Error('Empty streaming response');
        }
      } else {
        // Streaming not available, fallback to non-streaming
        throw new Error('Streaming not available');
      }
    } catch (err) {
      // If aborted with partial content, keep it
      if (
        err instanceof DOMException && err.name === 'AbortError' &&
        accumulatedRef.current
      ) {
        // Partial response preserved
      } else {
        // Remove any empty streaming message
        setMessages(prev =>
          prev.filter(m =>
            m.id === assistantMessageId ? m.content !== '' : true
          )
        );

        // Fallback: use non-streaming chat API
        try {
          const response = await aiApi.chat(text, {
            model: selectedModel || undefined,
            provider: selectedProvider || undefined,
            collections: selectedKnowledgeBases.length > 0 ? selectedKnowledgeBases : undefined,
            language: selectedLanguage || undefined,
            systemPrompt: customSystemPrompt || undefined,
          });

          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              response.data.answer || "Je n'ai pas pu generer de reponse.",
            sources: response.data.sources?.map(s => ({
              filename: s.filename,
              score: s.score,
            })),
            timestamp: new Date(),
          };

          setMessages(prev => [...prev, assistantMessage]);
        } catch {
          const errorMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              "Desole, je n'ai pas pu traiter votre demande. Le service IA est peut-etre indisponible. Verifiez que Ollama/vLLM est en cours d'execution.",
            timestamp: new Date(),
          };

          setMessages(prev => [...prev, errorMessage]);
        }
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSearch = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      const response = await aiApi.search(input, 5, selectedKnowledgeBases.length > 0 ? selectedKnowledgeBases : undefined);
      const results = response.data || [];

      if (results.length === 0) {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Aucun document pertinent trouve pour votre recherche.',
            timestamp: new Date(),
          },
        ]);
      } else {
        const resultText = results
          .map((r, i) => `${i + 1}. **${r.filename}** (score: ${(r.score * 100).toFixed(0)}%)\n   ${r.content.substring(0, 200)}...`)
          .join('\n\n');

        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'user',
            content: `Recherche: ${input}`,
            timestamp: new Date(),
          },
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `${results.length} document(s) pertinent(s) trouves:\n\n${resultText}`,
            sources: results.map(r => ({ filename: r.filename, score: r.score })),
            timestamp: new Date(),
          },
        ]);
      }
      setInput('');
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Voice chat hook
  const { voiceEnabled, voiceState, toggleVoice } = useVoiceChat({
    onTranscript: (text) => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
    },
    onAssistantMessage: (text) => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    provider: selectedProvider,
    model: selectedModel,
    language: selectedLanguage,
    systemPrompt: customSystemPrompt,
  });

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)]">
        {/* Sidebar - Conversation History */}
        <div className={cn(
          "flex flex-col border-r bg-muted/30 transition-all duration-300",
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        )}>
          <div className="flex items-center justify-between p-3 border-b">
            <h2 className="font-semibold text-sm">Historique</h2>
            <Button variant="ghost" size="icon" onClick={createNewChat}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucune conversation</p>
                  <Button variant="link" size="sm" onClick={createNewChat}>
                    Commencer une nouvelle
                  </Button>
                </div>
              ) : (
                conversations.map(conversation => (
                  <div
                    key={conversation.id}
                    className={cn(
                      "group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                      activeConversationId === conversation.id && "bg-muted"
                    )}
                    onClick={() => selectConversation(conversation)}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{conversation.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(conversation.updatedAt)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setConversationToRename(conversation);
                          setNewConversationTitle(conversation.title);
                          setRenameDialogOpen(true);
                        }}>
                          <Edit3 className="h-4 w-4 mr-2" />
                          Renommer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConversationToDelete(conversation);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-4 rounded-l-none rounded-r-md bg-muted hover:bg-muted-foreground/20"
          style={{ left: sidebarOpen ? '288px' : '0px' }}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Assistant IA</h1>
              {selectedKnowledgeBases.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Database className="h-3 w-3" />
                  {selectedKnowledgeBases.join(', ')}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Provider Selector */}
              <div className="flex items-center gap-2">
                {providers.find(p => p.id === selectedProvider)?.provider_type === 'llamacpp' ? (
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                ) : providers.find(p => p.id === selectedProvider)?.is_local ? (
                  <Server className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                )}
                <Select
                  value={selectedProvider}
                  onValueChange={(value) => {
                    const provider = providers.find(p => p.id === value);
                    if (provider) {
                      setSelectedModel(provider.default_model);
                    }
                    setSelectedProvider(value);
                  }}
                >
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.filter(p => p.enabled).map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          {provider.provider_type === 'llamacpp' ? (
                            <Cpu className="h-3 w-3" />
                          ) : provider.is_local ? (
                            <Server className="h-3 w-3" />
                          ) : (
                            <Cloud className="h-3 w-3" />
                          )}
                          {provider.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Selector */}
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedModel}
                  onValueChange={(value) => {
                    if (value === '__manage_models__') {
                      setActiveTab('models');
                      return;
                    }
                    setSelectedModel(value);
                  }}
                  disabled={loadingModels}
                >
                  <SelectTrigger className="w-[200px] h-8">
                    <SelectValue placeholder="Modele" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.filter(m => m.object !== 'model.available').map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.id}
                      </SelectItem>
                    ))}
                    {models.some(m => m.object === 'model.available') && (
                      <>
                        <DropdownMenuSeparator />
                        <SelectItem value="__manage_models__" className="text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Download className="h-3 w-3" />
                            Telecharger des modeles...
                          </div>
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedLanguage}
                  onValueChange={setSelectedLanguage}
                >
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue placeholder="Langue" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* System Prompt Settings */}
              <Button
                variant="outline"
                size="icon"
                className={cn("h-8 w-8", customSystemPrompt && "border-primary text-primary")}
                onClick={() => {
                  setTempSystemPrompt(customSystemPrompt);
                  setSystemPromptDialogOpen(true);
                }}
                title="Prompt systeme personnalise"
              >
                <Settings className="h-4 w-4" />
              </Button>

              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                {stats?.documents_count || 0} docs
              </Badge>

              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { fetchStats(); fetchProviders(); fetchKnowledgeBases(); }}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'knowledge' | 'models')} className="flex-1 flex flex-col">
            <div className="border-b px-4">
              <TabsList variant="line">
                <TabsTrigger value="chat">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="knowledge">
                  <Database className="h-4 w-4 mr-2" />
                  Knowledge Bases
                </TabsTrigger>
                <TabsTrigger value="models">
                  <Cpu className="h-4 w-4 mr-2" />
                  Modeles
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Chat Tab */}
            <TabsContent value="chat" className="flex-1 flex flex-col m-0">
              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-6 max-w-4xl mx-auto">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                      <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">Bienvenue dans l&apos;assistant IA</p>
                      <p className="text-sm mt-2">Selectionnez une conversation ou commencez-en une nouvelle</p>
                      <Button variant="outline" className="mt-4" onClick={createNewChat}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle conversation
                      </Button>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'flex gap-3',
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                            <Bot className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[80%] rounded-lg px-4 py-3',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {message.sources.map((source, i) => (
                                <Button
                                  key={i}
                                  variant="outline"
                                  size="sm"
                                  className="h-auto gap-1 py-1 text-xs bg-background/50"
                                >
                                  <FileText className="h-3 w-3" />
                                  {source.filename}
                                  {source.page && ` (p.${source.page})`}
                                  {source.score && (
                                    <Badge variant="secondary" className="ml-1 text-xs">
                                      {(source.score * 100).toFixed(0)}%
                                    </Badge>
                                  )}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3">
                        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 " />
                        <span className="text-sm">Reflexion en cours...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t p-4">
                <div className="max-w-4xl mx-auto">
                  {/* Knowledge Base selector and actions */}
                  <div className="flex items-center gap-2 mb-3">
                    {useAuthStore(s => s.user?.role) === 2 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="h-8 max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap">
                            <Database className="h-3 w-3 mr-2 shrink-0" />
                            {selectedKnowledgeBases.length === 0
                              ? "Toutes les bases"
                              : `${selectedKnowledgeBases.length} base(s) sél.`}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="start">
                          <DropdownMenuCheckboxItem
                            checked={selectedKnowledgeBases.length === 0}
                            onCheckedChange={() => setSelectedKnowledgeBases([])}
                          >
                            Toutes les bases
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuSeparator />
                          {knowledgeBases.map((kb) => (
                            <DropdownMenuCheckboxItem
                              key={kb.name}
                              checked={selectedKnowledgeBases.includes(kb.name)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedKnowledgeBases(prev => [...prev, kb.name]);
                                } else {
                                  setSelectedKnowledgeBases(prev => prev.filter(n => n !== kb.name));
                                }
                              }}
                            >
                              {kb.name} ({kb.documents_count})
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge variant="outline" className="h-8 px-3 font-normal text-muted-foreground bg-muted/50 cursor-not-allowed">
                        <Database className="h-3 w-3 mr-2" />
                        Base Personnelle
                      </Badge>
                    )}

                    <div className="flex-1" />

                    <Button variant="outline" size="sm" onClick={() => setUploadDialogOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      Indexer
                    </Button>

                    <Button variant="outline" size="sm" onClick={exportConversation} disabled={messages.length === 0}>
                      <Download className="mr-2 h-4 w-4" />
                      Exporter
                    </Button>

                    <Button variant="outline" size="sm" onClick={createNewChat}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nouveau
                    </Button>
                  </div>

                  {/* Message input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Posez une question sur vos documents..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <VoiceChatButton
                      voiceEnabled={voiceEnabled}
                      voiceState={voiceState}
                      onToggle={toggleVoice}
                    />
                    <Button
                      variant="outline"
                      onClick={handleSearch}
                      disabled={isLoading || !input.trim()}
                      title="Recherche semantique"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {voiceEnabled
                      ? 'Mode vocal actif — parlez, le micro detecte automatiquement votre voix'
                      : 'Appuyez sur Entree pour discuter avec l\u0027IA, ou cliquez sur Recherche pour une recherche semantique'}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Knowledge Bases Tab */}
            <TabsContent value="knowledge" className="flex-1 m-0 p-4 overflow-auto">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Knowledge Bases</h2>
                    <p className="text-sm text-muted-foreground">
                      Gerez vos collections de documents pour le RAG
                    </p>
                  </div>
                  <Button onClick={() => setCreateKbDialogOpen(true)}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Nouvelle collection
                  </Button>
                </div>

                {loadingKnowledgeBases ? (
                  <div className="flex items-center justify-center py-12">
                    <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8 " />
                  </div>
                ) : knowledgeBases.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Database className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium">Aucune knowledge base</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Creez une collection pour commencer a indexer vos documents
                      </p>
                      <Button onClick={() => setCreateKbDialogOpen(true)}>
                        <FolderPlus className="h-4 w-4 mr-2" />
                        Creer une collection
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {knowledgeBases.map((kb) => (
                      <Card key={kb.name} className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/50",
                        selectedKnowledgeBases.includes(kb.name) && "ring-2 ring-primary"
                      )}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Database className="h-5 w-5 text-primary" />
                              <CardTitle className="text-lg">{kb.name}</CardTitle>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  if (!selectedKnowledgeBases.includes(kb.name)) {
                                    setSelectedKnowledgeBases(prev => [...prev, kb.name]);
                                  }
                                  setActiveTab('chat');
                                }}>
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Utiliser pour le chat
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setUploadDialogOpen(true);
                                }}>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Ajouter des documents
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setKbToDelete(kb);
                                    setDeleteKbDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {kb.description && (
                            <p className="text-sm text-muted-foreground">{kb.description}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{kb.documents_count}</p>
                                <p className="text-xs text-muted-foreground">Documents</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <HardDrive className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{kb.chunks_count}</p>
                                <p className="text-xs text-muted-foreground">Chunks</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{formatBytes(kb.size_bytes)}</p>
                                <p className="text-xs text-muted-foreground">Taille</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Models Tab */}
            <TabsContent value="models" className="flex-1 m-0 p-4 overflow-auto">
              <ModelManagement
                onSelectLlmModel={(modelId) => {
                  setSelectedModel(modelId);
                  // Find the llamacpp provider and select it
                  const llmProvider = providers.find(p => p.provider_type === 'llamacpp');
                  if (llmProvider) {
                    setSelectedProvider(llmProvider.id);
                  }
                  setActiveTab('chat');
                  toast.success(`Modele ${modelId} selectionne`);
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Document Upload Dialog */}
      <DocumentUpload
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={() => {
          fetchStats();
          fetchKnowledgeBases();
        }}
      />

      {/* Rename Conversation Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la conversation</DialogTitle>
            <DialogDescription>
              Entrez un nouveau titre pour cette conversation.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newConversationTitle}
            onChange={(e) => setNewConversationTitle(e.target.value)}
            placeholder="Titre de la conversation"
            onKeyPress={(e) => e.key === 'Enter' && handleRenameConversation()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRenameConversation} disabled={!newConversationTitle.trim()}>
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Conversation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. La conversation &quot;{conversationToDelete?.title}&quot; sera definitivement supprimee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Knowledge Base Dialog */}
      <Dialog open={createKbDialogOpen} onOpenChange={setCreateKbDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Knowledge Base</DialogTitle>
            <DialogDescription>
              Creez une nouvelle collection pour organiser vos documents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom</label>
              <Input
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
                placeholder="ma-collection"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optionnel)</label>
              <Input
                value={newKbDescription}
                onChange={(e) => setNewKbDescription(e.target.value)}
                placeholder="Description de la collection..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateKbDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateKnowledgeBase} disabled={!newKbName.trim()}>
              Creer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* System Prompt Dialog */}
      <Dialog open={systemPromptDialogOpen} onOpenChange={setSystemPromptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prompt systeme personnalise</DialogTitle>
            <DialogDescription>
              Definissez un prompt systeme personnalise pour adapter le comportement de l&apos;IA.
              Laissez vide pour utiliser le prompt par defaut.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={tempSystemPrompt}
            onChange={(e) => setTempSystemPrompt(e.target.value)}
            placeholder="Ex: Tu es un expert Linux. Reponds de maniere concise et technique."
            rows={5}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTempSystemPrompt('');
                setCustomSystemPrompt('');
                setSystemPromptDialogOpen(false);
              }}
            >
              Reinitialiser
            </Button>
            <Button onClick={() => {
              setCustomSystemPrompt(tempSystemPrompt);
              setSystemPromptDialogOpen(false);
            }}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Knowledge Base Dialog */}
      <AlertDialog open={deleteKbDialogOpen} onOpenChange={setDeleteKbDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la Knowledge Base ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. La collection &quot;{kbToDelete?.name}&quot; et tous ses documents seront definitivement supprimes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKnowledgeBase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
