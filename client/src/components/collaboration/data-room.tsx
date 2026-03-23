"use client";

import { useState } from "react";
import { FileText, Eye, Download, MessageCircle, Droplet, Filter } from "lucide-react";

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  watermark: boolean;
  accessCount: number;
}

interface AccessLog {
  id: string;
  userName: string;
  action: string;
  timestamp: string;
  duration: string;
}

interface QAItem {
  id: string;
  question: string;
  answer: string;
  askedBy: string;
  answeredBy: string;
}

const DEFAULT_DOCS: Document[] = [
  {
    id: "1",
    name: "Financial_Statements_2025.pdf",
    type: "PDF",
    size: "2.4 MB",
    uploadedAt: "2026-03-20",
    watermark: true,
    accessCount: 12,
  },
  {
    id: "2",
    name: "Board_Minutes_Q1_2026.docx",
    type: "DOCX",
    size: "0.8 MB",
    uploadedAt: "2026-03-21",
    watermark: true,
    accessCount: 5,
  },
  {
    id: "3",
    name: "Legal_Opinion_Acquisition.pdf",
    type: "PDF",
    size: "1.1 MB",
    uploadedAt: "2026-03-19",
    watermark: true,
    accessCount: 8,
  },
];

const DEFAULT_LOGS: AccessLog[] = [
  {
    id: "1",
    userName: "John Smith",
    action: "Downloaded",
    timestamp: "2026-03-22 14:30",
    duration: "12 minutes",
  },
  {
    id: "2",
    userName: "Sarah Johnson",
    action: "Viewed",
    timestamp: "2026-03-22 13:15",
    duration: "8 minutes",
  },
  {
    id: "3",
    userName: "Michael Chen",
    action: "Viewed",
    timestamp: "2026-03-22 11:45",
    duration: "15 minutes",
  },
];

const DEFAULT_QA: QAItem[] = [
  {
    id: "1",
    question: "What is the total asset value as of Q4 2025?",
    answer: "Total assets: €125.4M as of Dec 31, 2025",
    askedBy: "Emma Wilson",
    answeredBy: "Finance Team",
  },
  {
    id: "2",
    question: "Are there any pending litigation cases?",
    answer: "No active litigation as of March 2026",
    askedBy: "Legal Advisor",
    answeredBy: "Legal Team",
  },
];

export function DataRoom() {
  const [documents, setDocuments] = useState<Document[]>(DEFAULT_DOCS);
  const [logs, setLogs] = useState<AccessLog[]>(DEFAULT_LOGS);
  const [qaItems, setQaItems] = useState<QAItem[]>(DEFAULT_QA);
  const [showNewQA, setShowNewQA] = useState(false);

  const totalAccess = documents.reduce((sum, doc) => sum + doc.accessCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data Room</h2>
          <p className="text-gray-600">
            Secure document repository with access controls
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-sm text-blue-700 font-medium">Documents</p>
          <p className="text-2xl font-bold text-blue-900">{documents.length}</p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4">
          <p className="text-sm text-purple-700 font-medium">Total Access Events</p>
          <p className="text-2xl font-bold text-purple-900">{totalAccess}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-sm text-green-700 font-medium">Q&A Items</p>
          <p className="text-2xl font-bold text-green-900">{qaItems.length}</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Documents</h3>
        </div>

        <div className="divide-y">
          {documents.map((doc) => (
            <div key={doc.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                      {doc.type}
                    </span>
                    <span className="text-xs text-gray-600">{doc.size}</span>
                    {doc.watermark && (
                      <span className="flex items-center gap-1 text-xs text-red-600">
                        <Droplet className="w-3 h-3" />
                        Watermarked
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-xs text-gray-600">{doc.uploadedAt}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {doc.accessCount} views
                </p>
              </div>

              <div className="flex gap-2 ml-4 flex-shrink-0">
                <button className="text-gray-500 hover:text-blue-600 p-2 rounded hover:bg-blue-50">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="text-gray-500 hover:text-green-600 p-2 rounded hover:bg-green-50">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Access Log</h3>
          <button className="ml-auto text-gray-600 hover:text-gray-900">
            <Filter className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y max-h-64 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{log.userName}</p>
                <p className="text-sm text-gray-600">{log.timestamp}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{log.action}</p>
                <p className="text-xs text-gray-600">{log.duration}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-gray-700" />
            <h3 className="font-semibold text-gray-900">Q&A Section</h3>
          </div>
          <button
            onClick={() => setShowNewQA(!showNewQA)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {showNewQA ? "Close" : "Ask Question"}
          </button>
        </div>

        {showNewQA && (
          <div className="border-b p-4 bg-blue-50">
            <textarea
              placeholder="Ask a question about the documents..."
              className="w-full p-2 border rounded-lg text-sm mb-2 focus:outline-none focus:border-blue-500"
              rows={3}
            />
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
              Submit Question
            </button>
          </div>
        )}

        <div className="divide-y">
          {qaItems.map((item) => (
            <div key={item.id} className="p-4 hover:bg-gray-50">
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Q: {item.question}
                </p>
                <p className="text-xs text-gray-600">Asked by {item.askedBy}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
                <p className="text-sm text-gray-900 mb-1">A: {item.answer}</p>
                <p className="text-xs text-gray-600">Answered by {item.answeredBy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
