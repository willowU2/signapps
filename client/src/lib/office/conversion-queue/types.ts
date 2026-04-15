/**
 * Conversion Queue Types
 *
 * Types for asynchronous document conversion jobs.
 */

// ============================================================================
// Job Status
// ============================================================================

export type JobStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type JobPriority = "low" | "normal" | "high" | "urgent";

export type ConversionType =
  | "docx_to_pdf"
  | "xlsx_to_pdf"
  | "pptx_to_pdf"
  | "pdf_to_docx"
  | "html_to_pdf"
  | "markdown_to_pdf"
  | "image_optimization"
  | "batch_export";

// ============================================================================
// Conversion Job
// ============================================================================

export interface ConversionJob {
  id: string;
  type: ConversionType;
  status: JobStatus;
  priority: JobPriority;
  progress: number; // 0-100

  // Source
  sourceDocumentId: string;
  sourceDocumentName: string;
  sourceMimeType: string;

  // Target
  targetFormat: string;
  targetMimeType: string;

  // Result
  resultFileId?: string;
  resultFileName?: string;
  resultFileSize?: number;
  downloadUrl?: string;

  // Timing
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: number; // seconds

  // Error
  error?: JobError;
  retryCount: number;
  maxRetries: number;

  // Options
  options?: ConversionOptions;

  // Metadata
  createdBy: string;
  workspaceId: string;
}

export interface JobError {
  code: string;
  message: string;
  details?: string;
  retryable: boolean;
}

export interface ConversionOptions {
  // PDF options
  pageSize?: "A4" | "Letter" | "Legal";
  orientation?: "portrait" | "landscape";
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  includeComments?: boolean;
  includeTrackChanges?: boolean;
  watermark?: string;
  password?: string;

  // Image options
  quality?: number; // 1-100
  maxWidth?: number;
  maxHeight?: number;
  format?: "jpeg" | "png" | "webp";

  // Batch options
  zipResults?: boolean;
  preserveStructure?: boolean;
}

// ============================================================================
// Queue Statistics
// ============================================================================

export interface QueueStats {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number; // seconds
  estimatedWaitTime: number; // seconds
}

export interface QueueHealth {
  status: "healthy" | "degraded" | "critical";
  workersActive: number;
  workersTotal: number;
  queueDepth: number;
  processingRate: number; // jobs per minute
  errorRate: number; // percentage
  lastHeartbeat: string;
}

// ============================================================================
// Batch Job
// ============================================================================

export interface BatchJob {
  id: string;
  name: string;
  status: JobStatus;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  jobs: string[]; // Job IDs
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  createdBy: string;
}

// ============================================================================
// API Requests/Responses
// ============================================================================

export interface CreateJobRequest {
  documentId: string;
  targetFormat: string;
  priority?: JobPriority;
  options?: ConversionOptions;
}

export interface CreateJobResponse {
  job: ConversionJob;
  estimatedWaitTime: number;
  queuePosition: number;
}

export interface CreateBatchJobRequest {
  name: string;
  documentIds: string[];
  targetFormat: string;
  priority?: JobPriority;
  options?: ConversionOptions;
}

export interface CreateBatchJobResponse {
  batch: BatchJob;
  jobs: ConversionJob[];
}

export interface ListJobsParams {
  status?: JobStatus;
  type?: ConversionType;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "priority" | "status";
  sortOrder?: "asc" | "desc";
}

export interface ListJobsResponse {
  jobs: ConversionJob[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// WebSocket Events
// ============================================================================

export type JobEventType =
  | "job:created"
  | "job:started"
  | "job:progress"
  | "job:completed"
  | "job:failed"
  | "job:cancelled";

export interface JobEvent {
  type: JobEventType;
  jobId: string;
  timestamp: string;
  data: Partial<ConversionJob>;
}

// ============================================================================
// Constants
// ============================================================================

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending: "En attente",
  queued: "Dans la file",
  processing: "En cours",
  completed: "Terminé",
  failed: "Échoué",
  cancelled: "Annulé",
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  pending: "bg-gray-100 text-gray-800",
  queued: "bg-blue-100 text-blue-800",
  processing: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export const JOB_PRIORITY_LABELS: Record<JobPriority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

export const JOB_PRIORITY_COLORS: Record<JobPriority, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

export const CONVERSION_TYPE_LABELS: Record<ConversionType, string> = {
  docx_to_pdf: "Word → PDF",
  xlsx_to_pdf: "Excel → PDF",
  pptx_to_pdf: "PowerPoint → PDF",
  pdf_to_docx: "PDF → Word",
  html_to_pdf: "HTML → PDF",
  markdown_to_pdf: "Markdown → PDF",
  image_optimization: "Optimisation image",
  batch_export: "Export par lot",
};

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  pageSize: "A4",
  orientation: "portrait",
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  includeComments: false,
  includeTrackChanges: false,
  quality: 90,
};
