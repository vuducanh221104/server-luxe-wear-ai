/**
 * @file fileProcessor.ts
 * @description File processing utilities for extracting text from various file formats
 * Supports PDF, DOC, DOCX, TXT files and converts them to text for vector storage
 */

import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";
import { batchStoreKnowledge } from "../services/vectorizer.service";
import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";

/**
 * Supported file types for upload
 */
export const SUPPORTED_FILE_TYPES = {
  PDF: "application/pdf",
  DOC: "application/msword",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  TXT: "text/plain",
  MD: "text/markdown",
} as const;

/**
 * Maximum file size (1GB)
 */
export const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024;

/**
 * Interface for extracted text result
 */
export interface ExtractedText {
  content: string;
  metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
    pageCount?: number;
    wordCount: number;
    extractedAt: string;
  };
}

/**
 * Extract text from PDF file
 */
const extractFromPDF = async (buffer: Buffer, fileName: string): Promise<ExtractedText> => {
  try {
    const { default: pdfParse } = await import("pdf-parse");
    const data = await (
      pdfParse as unknown as (buffer: Buffer) => Promise<{ text: string; numpages: number }>
    )(buffer);

    return {
      content: data.text.trim(),
      metadata: {
        fileName,
        fileType: SUPPORTED_FILE_TYPES.PDF,
        fileSize: buffer.length,
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).length,
        extractedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error("PDF extraction failed", {
      fileName,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

/**
 * Extract text from DOC/DOCX file
 */
const extractFromWord = async (
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ExtractedText> => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const content = result.value.trim();

    if (result.messages.length > 0) {
      logger.warn("Word document extraction warnings", {
        fileName,
        warnings: result.messages.map((m) => m.message),
      });
    }

    return {
      content,
      metadata: {
        fileName,
        fileType: mimeType,
        fileSize: buffer.length,
        wordCount: content.split(/\s+/).length,
        extractedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error("Word document extraction failed", {
      fileName,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error(
      `Failed to extract text from Word document: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

/**
 * Extract text from plain text file
 */
const extractFromText = async (
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ExtractedText> => {
  try {
    const content = buffer.toString("utf-8").trim();

    return {
      content,
      metadata: {
        fileName,
        fileType: mimeType,
        fileSize: buffer.length,
        wordCount: content.split(/\s+/).length,
        extractedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error("Text file extraction failed", {
      fileName,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error(
      `Failed to extract text from file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

/**
 * Main function to extract text from uploaded file
 * @param file - Multer file object
 * @returns Extracted text and metadata
 */
export const extractTextFromFile = async (file: Express.Multer.File): Promise<ExtractedText> => {
  const { buffer, originalname, mimetype, size } = file;

  logger.info("Starting file text extraction", {
    fileName: originalname,
    fileType: mimetype,
    fileSize: size,
  });

  // Validate file size
  if (size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Validate file type
  const supportedTypes = Object.values(SUPPORTED_FILE_TYPES) as string[];
  if (!supportedTypes.includes(mimetype)) {
    throw new Error(
      `Unsupported file type: ${mimetype}. Supported types: ${supportedTypes.join(", ")}`
    );
  }

  // Extract text based on file type
  let extractedText: ExtractedText;

  switch (mimetype) {
    case SUPPORTED_FILE_TYPES.PDF:
      extractedText = await extractFromPDF(buffer, originalname);
      break;

    case SUPPORTED_FILE_TYPES.DOC:
    case SUPPORTED_FILE_TYPES.DOCX:
      extractedText = await extractFromWord(buffer, originalname, mimetype);
      break;

    case SUPPORTED_FILE_TYPES.TXT:
    case SUPPORTED_FILE_TYPES.MD:
      extractedText = await extractFromText(buffer, originalname, mimetype);
      break;

    default:
      throw new Error(`Unsupported file type: ${mimetype}`);
  }

  // Validate extracted content
  if (!extractedText.content || extractedText.content.length < 10) {
    throw new Error(
      "Extracted text is too short or empty. Please check if the file contains readable text."
    );
  }

  if (extractedText.content.length > 100000) {
    logger.warn("Large file content extracted", {
      fileName: originalname,
      contentLength: extractedText.content.length,
    });
  }

  logger.info("File text extraction completed", {
    fileName: originalname,
    contentLength: extractedText.content.length,
    wordCount: extractedText.metadata.wordCount,
  });

  return extractedText;
};

/**
 * Chunk large text into smaller pieces for better vector storage
 * @param text - Text to chunk
 * @param maxChunkSize - Maximum size per chunk (default: 1000 characters)
 * @param overlap - Overlap between chunks (default: 100 characters)
 * @returns Array of text chunks
 */
export const chunkText = (
  text: string,
  maxChunkSize: number = 1000,
  overlap: number = 100
): string[] => {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChunkSize;

    // Try to break at sentence or paragraph boundaries
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + maxChunkSize / 2) {
        end = breakPoint + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
  }

  return chunks;
};

/**
 * Optimized chunking for vector search (sentence-based)
 * @param text - Text to chunk
 * @param maxLength - Maximum length per chunk (default: 1000)
 * @returns Array of text chunks
 */
export const chunkTextForVector = (text: string, maxLength: number = 1000): string[] => {
  const sentences = text.split(/[.!?]+\s+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    if ((currentChunk + trimmedSentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? ". " : "") + trimmedSentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

/**
 * Validate file before processing
 * @param file - Multer file object
 * @returns Validation result
 */
export const validateFile = (file: Express.Multer.File): { isValid: boolean; error?: string } => {
  if (!file) {
    return { isValid: false, error: "No file provided" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  const supportedTypes = Object.values(SUPPORTED_FILE_TYPES) as string[];
  if (!supportedTypes.includes(file.mimetype)) {
    return {
      isValid: false,
      error: `Unsupported file type: ${file.mimetype}. Supported types: ${supportedTypes.join(", ")}`,
    };
  }

  return { isValid: true };
};

/**
 * File processing result interface
 */
interface FileProcessingResult {
  fileName: string;
  chunks: number;
  status: "success" | "error";
  error?: string;
  entries: Array<{
    knowledgeEntry: Record<string, unknown>;
    vectorEntry: {
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
    };
  }>;
}

/**
 * Process a single file with optimized error handling
 */
const processFile = async (
  file: Express.Multer.File,
  userId: string,
  agentId: string | null,
  chunkSize: string,
  _overlap: string
): Promise<FileProcessingResult> => {
  // Validate file
  const validation = validateFile(file);
  if (!validation.isValid) {
    logger.warn("Skipping invalid file", {
      fileName: file.originalname,
      error: validation.error,
      userId,
    });
    return {
      fileName: file.originalname,
      chunks: 0,
      status: "error",
      error: validation.error,
      entries: [],
    };
  }

  try {
    // Extract text from file
    const extractedText = await extractTextFromFile(file);
    const knowledgeTitle = extractedText.metadata.fileName.replace(/\.[^/.]+$/, "");

    // Chunk text if it's large
    const chunks = chunkText(extractedText.content, parseInt(chunkSize));

    // Create knowledge entries for each chunk
    const entries = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = uuidv4();
      const chunkTitle = chunks.length > 1 ? `${knowledgeTitle} (Part ${i + 1})` : knowledgeTitle;

      entries.push({
        knowledgeEntry: {
          id: chunkId,
          title: chunkTitle,
          content: chunks[i],
          metadata: {
            ...extractedText.metadata,
            chunkIndex: i,
            totalChunks: chunks.length,
            isFromFile: true,
          },
          agent_id: agentId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        vectorEntry: {
          id: chunkId,
          content: chunks[i],
          metadata: {
            userId,
            title: chunkTitle,
            agentId,
            fileName: extractedText.metadata.fileName,
            fileType: extractedText.metadata.fileType,
            chunkIndex: i,
            totalChunks: chunks.length,
            isFromFile: true,
          },
        },
      });
    }

    return {
      fileName: file.originalname,
      chunks: chunks.length,
      status: "success",
      entries,
    };
  } catch (error) {
    logger.error("File processing error", {
      fileName: file.originalname,
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
    });

    return {
      fileName: file.originalname,
      chunks: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      entries: [],
    };
  }
};

/**
 * Optimized batch file upload with Promise.all()
 */
export const uploadMultipleFilesOptimized = async (
  files: Express.Multer.File[],
  userId: string,
  agentId: string | null,
  chunkSize: string = "1000",
  overlap: string = "100"
): Promise<{
  success: boolean;
  processedFiles: FileProcessingResult[];
  totalChunks: number;
  totalKnowledgeEntries: number;
  errors: string[];
}> => {
  try {
    logger.info("Starting optimized batch file upload", {
      fileCount: files.length,
      fileNames: files.map((f) => f.originalname),
      userId,
      agentId,
    });

    // Parallel: Process all files at once
    const fileProcessingPromises = files.map((file) =>
      processFile(file, userId, agentId, chunkSize, overlap)
    );

    const processedFiles = await Promise.all(fileProcessingPromises);

    // Separate successful and failed files
    const successfulFiles = processedFiles.filter((f) => f.status === "success");
    const failedFiles = processedFiles.filter((f) => f.status === "error");

    // Flatten all entries from successful files
    const allKnowledgeEntries: Record<string, unknown>[] = [];
    const allVectorEntries: Array<{
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
    }> = [];

    successfulFiles.forEach((fileResult) => {
      fileResult.entries.forEach((chunk) => {
        allKnowledgeEntries.push(chunk.knowledgeEntry);
        allVectorEntries.push(chunk.vectorEntry);
      });
    });

    // Parallel: Store in database and vector database
    const [dbResult] = await Promise.all([
      allKnowledgeEntries.length > 0
        ? supabaseAdmin.from("knowledge").insert(allKnowledgeEntries)
        : Promise.resolve({ data: [], error: null }),
      allVectorEntries.length > 0 ? batchStoreKnowledge(allVectorEntries) : Promise.resolve(),
    ]);

    // Check for database errors
    if (dbResult.error) {
      logger.error("Database insert failed", { error: dbResult.error });
      throw new Error(`Database error: ${dbResult.error.message}`);
    }

    const totalChunks = successfulFiles.reduce((sum, file) => sum + file.chunks, 0);
    const errors = failedFiles.map((f) => `${f.fileName}: ${f.error}`);

    logger.info("Optimized batch file upload completed", {
      totalFiles: files.length,
      successfulFiles: successfulFiles.length,
      failedFiles: failedFiles.length,
      totalChunks,
      totalKnowledgeEntries: allKnowledgeEntries.length,
    });

    return {
      success: true,
      processedFiles,
      totalChunks,
      totalKnowledgeEntries: allKnowledgeEntries.length,
      errors,
    };
  } catch (error) {
    logger.error("Optimized batch file upload failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
      fileCount: files.length,
    });

    return {
      success: false,
      processedFiles: [],
      totalChunks: 0,
      totalKnowledgeEntries: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
};
