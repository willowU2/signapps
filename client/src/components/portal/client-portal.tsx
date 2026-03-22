'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, FileText, MessageSquare, ChevronRight, Loader2 } from 'lucide-react'

interface Project {
  id: string
  name: string
  status: 'active' | 'completed' | 'pending'
  lastUpdated: string
}

interface SharedDocument {
  id: string
  name: string
  type: 'contract' | 'invoice' | 'proposal'
  sharedDate: string
}

interface Message {
  id: string
  sender: string
  subject: string
  date: string
  unread: boolean
}

export function ClientPortal() {
  const [projects, setProjects] = useState<Project[]>([])
  const [documents, setDocuments] = useState<SharedDocument[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data - replace with API call
    const mockProjects: Project[] = [
      {
        id: '1',
        name: 'Website Redesign',
        status: 'active',
        lastUpdated: '2 days ago',
      },
      {
        id: '2',
        name: 'Marketing Campaign',
        status: 'pending',
        lastUpdated: '5 days ago',
      },
      {
        id: '3',
        name: 'Q4 Planning',
        status: 'completed',
        lastUpdated: '1 week ago',
      },
    ]

    const mockDocuments: SharedDocument[] = [
      { id: '1', name: 'Service Agreement', type: 'contract', sharedDate: '3 days ago' },
      { id: '2', name: 'Invoice #2024-001', type: 'invoice', sharedDate: '1 week ago' },
      { id: '3', name: 'Project Proposal', type: 'proposal', sharedDate: '2 weeks ago' },
    ]

    const mockMessages: Message[] = [
      {
        id: '1',
        sender: 'Project Manager',
        subject: 'Update on your request',
        date: 'Today',
        unread: true,
      },
      {
        id: '2',
        sender: 'Support Team',
        subject: 'Your issue has been resolved',
        date: 'Yesterday',
        unread: false,
      },
      {
        id: '3',
        sender: 'Account Manager',
        subject: 'Quarterly review scheduled',
        date: '2 days ago',
        unread: false,
      },
    ]

    setProjects(mockProjects)
    setDocuments(mockDocuments)
    setMessages(mockMessages)
    setLoading(false)
  }, [])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      pending: 'secondary',
      completed: 'outline',
    }
    return (
      <Badge variant={variants[status] || 'default'} className="capitalize">
        {status}
      </Badge>
    )
  }

  const getDocumentIcon = (type: string) => {
    return <FileText className="w-4 h-4" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Projects Section */}
      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
          <CardDescription>Projects you're collaborating on</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer">
                <div className="flex-1">
                  <p className="font-medium">{project.name}</p>
                  <p className="text-sm text-muted-foreground">{project.lastUpdated}</p>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(project.status)}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4">
            View All Projects
          </Button>
        </CardContent>
      </Card>

      {/* Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle>Shared Documents</CardTitle>
          <CardDescription>Documents shared with you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer">
                <div className="flex items-center gap-3 flex-1">
                  {getDocumentIcon(doc.type)}
                  <div>
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{doc.type} • {doc.sharedDate}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4">
            View All Documents
          </Button>
        </CardContent>
      </Card>

      {/* Messages Section */}
      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>Communication with your account team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer ${msg.unread ? 'bg-muted/50' : ''}`}>
                <div className="flex items-center gap-3 flex-1">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${msg.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {msg.sender}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{msg.subject}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{msg.date}</p>
                  {msg.unread && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 ml-auto" />}
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4">
            View All Messages
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
