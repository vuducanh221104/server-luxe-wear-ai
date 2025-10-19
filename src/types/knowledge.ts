/**
 * @file knowledge.ts
 * @description Knowledge base types and interfaces
 * Handles knowledge management operations with multi-tenancy support
 */

// import { Tables } from "./database";

/**
 * Knowledge base entry
 */
export interface Knowledge {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  agent_id: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Knowledge insert data
 */
export interface KnowledgeInsert {
  id?: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  agent_id?: string | null;
  tenant_id: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Knowledge update data
 */
export interface KnowledgeUpdate {
  title?: string;
  content?: string;
  metadata?: Record<string, any>;
  agent_id?: string | null;
  updated_at?: string;
}

/**
 * Knowledge list options
 */
export interface KnowledgeListOptions {
  page?: number;
  limit?: number;
  agentId?: string;
  search?: string;
}

/**
 * Knowledge list response
 */
export interface KnowledgeListResponse {
  knowledge: Knowledge[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Knowledge statistics
 */
export interface KnowledgeStats {
  total: number;
  withAgents: number;
  standalone: number;
  recent: number;
}

/**
 * Knowledge search options
 */
export interface KnowledgeSearchOptions {
  query: string;
  page?: number;
  limit?: number;
  agentId?: string;
}

/**
 * Knowledge search result
 */
export interface KnowledgeSearchResult {
  id: string;
  score: number;
  title: string;
  content: string;
  metadata: Record<string, any>;
  agentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Knowledge search response
 */
export interface KnowledgeSearchResponse {
  query: string;
  results: KnowledgeSearchResult[];
  totalFound: number;
}

/**
 * Knowledge file upload result
 */
export interface KnowledgeFileUploadResult {
  file: {
    originalName: string;
    size: number;
    type: string;
  };
  extracted: {
    contentLength: number;
    wordCount: number;
    pageCount: number;
  };
  knowledge: {
    chunksCreated: number;
    entries: Array<{
      id: string;
      title: string;
      contentPreview: string;
      agentId: string | null;
      createdAt: string;
    }>;
  };
}

/**
 * Knowledge batch upload result
 */
export interface KnowledgeBatchUploadResult {
  filesProcessed: number;
  totalChunksCreated: number;
  files: Array<{
    fileName: string;
    chunksCreated: number;
    contentLength: number;
    wordCount: number;
  }>;
  knowledge: {
    entries: Array<{
      id: string;
      title: string;
      contentPreview: string;
      agentId: string | null;
      createdAt: string;
    }>;
  };
}

/**
 * Knowledge chunk data for vector storage
 */
export interface KnowledgeChunkData {
  id: string;
  content: string;
  metadata: {
    userId: string;
    tenantId: string;
    title: string;
    agentId?: string | null;
    fileName?: string;
    fileType?: string;
    chunkIndex?: number;
    totalChunks?: number;
    isFromFile?: boolean;
    [key: string]: any;
  };
}

/**
 * Knowledge vector search result
 */
export interface KnowledgeVectorSearchResult {
  id: string;
  score: number;
  metadata: {
    userId: string;
    tenantId: string;
    title: string;
    agentId?: string | null;
    [key: string]: any;
  };
}

/**
 * Knowledge vector search options
 */
export interface KnowledgeVectorSearchOptions {
  query: string;
  topK?: number;
  tenantId?: string;
  agentId?: string;
  minScore?: number;
}

/**
 * Knowledge vector search response
 */
export interface KnowledgeVectorSearchResponse {
  query: string;
  results: KnowledgeVectorSearchResult[];
  totalFound: number;
  searchTime: number;
}

/**
 * Knowledge processing status
 */
export enum KnowledgeProcessingStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

/**
 * Knowledge processing job
 */
export interface KnowledgeProcessingJob {
  id: string;
  knowledgeId: string;
  status: KnowledgeProcessingStatus;
  progress: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Knowledge processing options
 */
export interface KnowledgeProcessingOptions {
  chunkSize?: number;
  overlap?: number;
  maxChunks?: number;
  preserveFormatting?: boolean;
  extractMetadata?: boolean;
}

/**
 * Knowledge export options
 */
export interface KnowledgeExportOptions {
  format: "json" | "csv" | "txt";
  includeMetadata?: boolean;
  includeContent?: boolean;
  agentId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Knowledge export result
 */
export interface KnowledgeExportResult {
  format: string;
  data: string | Buffer;
  filename: string;
  size: number;
  count: number;
}

/**
 * Knowledge import options
 */
export interface KnowledgeImportOptions {
  format: "json" | "csv" | "txt";
  agentId?: string;
  overwrite?: boolean;
  validate?: boolean;
}

/**
 * Knowledge import result
 */
export interface KnowledgeImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

/**
 * Knowledge validation result
 */
export interface KnowledgeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Knowledge quality metrics
 */
export interface KnowledgeQualityMetrics {
  totalEntries: number;
  averageLength: number;
  completenessScore: number;
  consistencyScore: number;
  relevanceScore: number;
  lastUpdated: string;
}

/**
 * Knowledge analytics data
 */
export interface KnowledgeAnalytics {
  totalKnowledge: number;
  knowledgeByAgent: Record<string, number>;
  knowledgeByType: Record<string, number>;
  recentActivity: Array<{
    id: string;
    title: string;
    action: string;
    timestamp: string;
  }>;
  qualityMetrics: KnowledgeQualityMetrics;
}

/**
 * Knowledge backup data
 */
export interface KnowledgeBackupData {
  version: string;
  timestamp: string;
  tenantId: string;
  knowledge: Knowledge[];
  metadata: {
    totalEntries: number;
    totalSize: number;
    agentCount: number;
  };
}

/**
 * Knowledge restore options
 */
export interface KnowledgeRestoreOptions {
  backupData: KnowledgeBackupData;
  overwrite?: boolean;
  validate?: boolean;
  agentMapping?: Record<string, string>;
}

/**
 * Knowledge restore result
 */
export interface KnowledgeRestoreResult {
  success: boolean;
  restored: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

// Types are exported individually above
