'use client';

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
import {
  Send,
  Bot,
  User,
  FileText,
  Loader2,
  Plus,
  Upload,
  Search,
  RefreshCw,
  Cpu,
  Server,
  Cloud,
  MessageSquare,
  Trash2,
  Edit3,
  MoreVertical,
  Download,
  Database,
  FolderPlus,
  HardDrive,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { aiApi, AIStats, Model, ProviderInfo, KnowledgeBase } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DocumentUpload } from '@/components/ai/document-upload';
import { toast } from 'sonner';

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
  knowledgeBase?: string;
  createdAt: Date;
  updatedAt: Date;
}

// LocalStorage keys
const CONVERSATIONS_KEY = 'signapps_ai_conversations';
const ACTIVE_CONVERSATION_KEY = 'signapps_ai_active_conversation';

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
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<string>('');
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

  // Tab state
  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge'>('chat');

  const scrollRef = useRef<HTMLDivElement>(null);

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
        setSelectedKnowledgeBase(active.knowledgeBase || '');
      }
    }
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
    } catch (error) {
      console.error('Failed to fetch AI stats:', error);
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
      if (!selectedProvider) {
        const defaultProvider = providerList.find(p => p.id === activeProvider && p.enabled)
          || providerList.find(p => p.enabled);
        if (defaultProvider) {
          setSelectedProvider(defaultProvider.id);
          if (!selectedModel) {
            setSelectedModel(defaultProvider.default_model);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviders([{
        id: 'ollama',
        name: 'Ollama (Local)',
        provider_type: 'ollama',
        enabled: true,
        default_model: 'llama3.2:3b',
        is_local: true,
      }]);
      if (!selectedProvider) {
        setSelectedProvider('ollama');
      }
    }
  }, [selectedProvider, selectedModel]);

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const response = await aiApi.models();
      const modelList = response.data.models || [];
      setModels(modelList);
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setModels([{ id: 'default', name: 'Default Model' }]);
      if (!selectedModel) {
        setSelectedModel('default');
      }
    } finally {
      setLoadingModels(false);
    }
  }, [selectedModel]);

  const fetchKnowledgeBases = useCallback(async () => {
    setLoadingKnowledgeBases(true);
    try {
      const response = await aiApi.listCollections();
      setKnowledgeBases(response.data.collections || []);
    } catch (error) {
      console.error('Failed to fetch knowledge bases:', error);
      // Provide mock data for development
      setKnowledgeBases([
        {
          name: 'default',
          description: 'Collection par defaut',
          documents_count: stats?.documents_count || 0,
          chunks_count: stats?.chunks_count || 0,
          size_bytes: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoadingKnowledgeBases(false);
    }
  }, [stats]);

  useEffect(() => {
    fetchStats();
    fetchProviders();
    fetchModels();
    fetchKnowledgeBases();
  }, [fetchStats, fetchProviders, fetchModels, fetchKnowledgeBases]);

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
      knowledgeBase: selectedKnowledgeBase,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setMessages(newConversation.messages);
  }, [selectedKnowledgeBase]);

  const selectConversation = useCallback((conversation: Conversation) => {
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
    setSelectedKnowledgeBase(conversation.knowledgeBase || '');
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
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      toast.error('Erreur lors de la creation');
    }
  }, [newKbName, newKbDescription, fetchKnowledgeBases]);

  const handleDeleteKnowledgeBase = useCallback(async () => {
    if (!kbToDelete) return;

    try {
      await aiApi.deleteCollection(kbToDelete.name);
      await fetchKnowledgeBases();

      if (selectedKnowledgeBase === kbToDelete.name) {
        setSelectedKnowledgeBase('');
      }

      setDeleteKbDialogOpen(false);
      setKbToDelete(null);
      toast.success('Knowledge base supprimee');
    } catch (error) {
      console.error('Failed to delete knowledge base:', error);
      toast.error('Erreur lors de la suppression');
    }
  }, [kbToDelete, selectedKnowledgeBase, fetchKnowledgeBases]);

  const exportConversation = useCallback(() => {
    if (messages.length === 0) return;

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const title = activeConversation?.title || 'conversation';

    let markdown = `# ${title}\n\n`;
    markdown += `*Exporte le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}*\n\n`;

    if (selectedKnowledgeBase) {
      markdown += `**Knowledge Base:** ${selectedKnowledgeBase}\n\n`;
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
  }, [messages, conversations, activeConversationId, selectedKnowledgeBase]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Create new conversation if none active
    if (!activeConversationId) {
      createNewChat();
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await aiApi.chat(input, {
        model: selectedModel || undefined,
        provider: selectedProvider || undefined,
        collection: selectedKnowledgeBase || undefined,
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.data.answer || 'Je n\'ai pas pu generer de reponse.',
        sources: response.data.sources?.map(s => ({
          filename: s.filename,
          score: s.score,
        })),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Desole, je n\'ai pas pu traiter votre demande. Le service IA est peut-etre indisponible. Verifiez que vLLM et le service d\'embeddings sont en cours d\'execution.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
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
      const response = await aiApi.search(input, 5, selectedKnowledgeBase || undefined);
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
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
              {selectedKnowledgeBase && (
                <Badge variant="secondary" className="gap-1">
                  <Database className="h-3 w-3" />
                  {selectedKnowledgeBase}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Provider Selector */}
              <div className="flex items-center gap-2">
                {providers.find(p => p.id === selectedProvider)?.is_local ? (
                  <Server className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                )}
                <Select
                  value={selectedProvider}
                  onValueChange={(value) => {
                    setSelectedProvider(value);
                    const provider = providers.find(p => p.id === value);
                    if (provider) {
                      setSelectedModel(provider.default_model);
                    }
                  }}
                >
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.filter(p => p.enabled).map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          {provider.is_local ? (
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
                  onValueChange={setSelectedModel}
                  disabled={loadingModels}
                >
                  <SelectTrigger className="w-[160px] h-8">
                    <SelectValue placeholder="Modele" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                {stats?.documents_count || 0} docs
              </Badge>

              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { fetchStats(); fetchKnowledgeBases(); }}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'knowledge')} className="flex-1 flex flex-col">
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
                        <Loader2 className="h-4 w-4 animate-spin" />
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
                    <Select
                      value={selectedKnowledgeBase || '__all__'}
                      onValueChange={(value) => setSelectedKnowledgeBase(value === '__all__' ? '' : value)}
                    >
                      <SelectTrigger className="w-[200px] h-8">
                        <Database className="h-3 w-3 mr-2" />
                        <SelectValue placeholder="Toutes les bases" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Toutes les bases</SelectItem>
                        {knowledgeBases.map((kb) => (
                          <SelectItem key={kb.name} value={kb.name}>
                            {kb.name} ({kb.documents_count} docs)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

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
                    <Button
                      variant="outline"
                      onClick={handleSearch}
                      disabled={isLoading || !input.trim()}
                      title="Recherche semantique"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Appuyez sur Entree pour discuter avec l&apos;IA, ou cliquez sur Recherche pour une recherche semantique
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
                    <Loader2 className="h-8 w-8 animate-spin" />
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
                        selectedKnowledgeBase === kb.name && "ring-2 ring-primary"
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
                                  setSelectedKnowledgeBase(kb.name);
                                  setActiveTab('chat');
                                }}>
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Utiliser pour le chat
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedKnowledgeBase(kb.name);
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
