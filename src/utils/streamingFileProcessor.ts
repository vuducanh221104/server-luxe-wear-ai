/**
 * @file streaming-file-processor.ts
 * @description Streaming file processing utilities
 * Handles chunked text extraction and processing for large files
 */

import { v4 as uuidv4 } from "uuid";
import { StreamingFile } from "../types/upload";
import logger from "../config/logger";

// Define supported file types locally
const SUPPORTED_FILE_TYPES = {
  PDF: "application/pdf",
  DOC: "application/msword",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  TXT: "text/plain",
  MD: "text/markdown",
} as const;

// Interface for streaming processing result
export interface StreamingProcessingResult {
  fileId: string;
  fileName: string;
  status: "processing" | "completed" | "error";
  chunks: number;
  totalSize: number;
  processedSize: number;
  error?: string;
  entries: Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  }>;
}

// Interface for chunk processing
export interface ChunkProcessor {
  processChunk(chunk: Buffer, metadata: ChunkMetadata): Promise<string>;
  finalize(): Promise<string>;
}

// Interface for chunk metadata
export interface ChunkMetadata {
  fileId: string;
  fileName: string;
  mimeType: string;
  chunkIndex: number;
  totalChunks: number;
  offset: number;
  size: number;
}

/**
 * PDF streaming processor using pdf-parse with chunks
 */
class PDFStreamingProcessor implements ChunkProcessor {
  private chunks: Buffer[] = [];
  private metadata: ChunkMetadata | null = null;

  async processChunk(chunk: Buffer, metadata: ChunkMetadata): Promise<string> {
    this.chunks.push(chunk);
    this.metadata = metadata;
    return ""; // Return empty for now, process at finalize
  }

  async finalize(): Promise<string> {
    if (!this.metadata || this.chunks.length === 0) {
      throw new Error("No chunks to process");
    }

    try {
      const fullBuffer = Buffer.concat(this.chunks);

      // Use pdf-parse for text extraction
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(fullBuffer);

      logger.info("PDF streaming processing completed", {
        fileId: this.metadata.fileId,
        fileName: this.metadata.fileName,
        pageCount: data.numpages,
        textLength: data.text.length,
        chunksProcessed: this.chunks.length,
      });

      return data.text.trim();
    } catch (error) {
      logger.error("PDF streaming processing failed", {
        fileId: this.metadata?.fileId,
        fileName: this.metadata?.fileName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

/**
 * Word document streaming processor using mammoth
 */
class WordStreamingProcessor implements ChunkProcessor {
  private chunks: Buffer[] = [];
  private metadata: ChunkMetadata | null = null;

  async processChunk(chunk: Buffer, metadata: ChunkMetadata): Promise<string> {
    this.chunks.push(chunk);
    this.metadata = metadata;
    return ""; // Return empty for now, process at finalize
  }

  async finalize(): Promise<string> {
    if (!this.metadata || this.chunks.length === 0) {
      throw new Error("No chunks to process");
    }

    try {
      const fullBuffer = Buffer.concat(this.chunks);

      // Use mammoth for Word document extraction
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: fullBuffer });

      if (result.messages.length > 0) {
        logger.warn("Word document extraction warnings", {
          fileId: this.metadata.fileId,
          fileName: this.metadata.fileName,
          warnings: result.messages.map((m) => m.message),
        });
      }

      logger.info("Word streaming processing completed", {
        fileId: this.metadata.fileId,
        fileName: this.metadata.fileName,
        textLength: result.value.length,
        chunksProcessed: this.chunks.length,
      });

      return result.value.trim();
    } catch (error) {
      logger.error("Word streaming processing failed", {
        fileId: this.metadata?.fileId,
        fileName: this.metadata?.fileName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

/**
 * Text file streaming processor
 */
class TextStreamingProcessor implements ChunkProcessor {
  private chunks: Buffer[] = [];
  private metadata: ChunkMetadata | null = null;

  async processChunk(chunk: Buffer, metadata: ChunkMetadata): Promise<string> {
    this.chunks.push(chunk);
    this.metadata = metadata;
    return ""; // Return empty for now, process at finalize
  }

  async finalize(): Promise<string> {
    if (!this.metadata || this.chunks.length === 0) {
      throw new Error("No chunks to process");
    }

    try {
      const fullBuffer = Buffer.concat(this.chunks);
      const content = fullBuffer.toString("utf-8").trim();

      logger.info("Text streaming processing completed", {
        fileId: this.metadata.fileId,
        fileName: this.metadata.fileName,
        textLength: content.length,
        chunksProcessed: this.chunks.length,
      });

      return content;
    } catch (error) {
      logger.error("Text streaming processing failed", {
        fileId: this.metadata?.fileId,
        fileName: this.metadata?.fileName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

/**
 * Create appropriate processor based on file type
 */
const createProcessor = (mimeType: string): ChunkProcessor => {
  switch (mimeType) {
    case SUPPORTED_FILE_TYPES.PDF:
      return new PDFStreamingProcessor();
    case SUPPORTED_FILE_TYPES.DOC:
    case SUPPORTED_FILE_TYPES.DOCX:
      return new WordStreamingProcessor();
    case SUPPORTED_FILE_TYPES.TXT:
    case SUPPORTED_FILE_TYPES.MD:
      return new TextStreamingProcessor();
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
};

/**
 * Process streaming file with chunked approach
 */
export const processStreamingFile = async (
  file: StreamingFile,
  userId: string,
  agentId: string | null,
  chunkSize: number = 5000,
  _overlap: number = 200
): Promise<StreamingProcessingResult> => {
  const startTime = Date.now();

  logger.info("Starting streaming file processing", {
    fileId: file.id,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
    userId,
  });

  try {
    // Validate file type
    const supportedTypes = Object.values(SUPPORTED_FILE_TYPES);
    if (!supportedTypes.includes(file.mimetype as (typeof supportedTypes)[number])) {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }

    // Create processor
    const processor = createProcessor(file.mimetype);

    // Process file in chunks for large files
    const chunkSizeBytes = Math.min(1024 * 1024, file.size); // 1MB chunks max
    const chunks: Buffer[] = [];

    for (let offset = 0; offset < file.buffer.length; offset += chunkSizeBytes) {
      const chunk = file.buffer.slice(offset, offset + chunkSizeBytes);
      chunks.push(chunk);
    }

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkMetadata: ChunkMetadata = {
        fileId: file.id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        chunkIndex: i,
        totalChunks: chunks.length,
        offset: i * chunkSizeBytes,
        size: chunks[i].length,
      };

      await processor.processChunk(chunks[i], chunkMetadata);
    }

    // Finalize processing
    const extractedText: string = await processor.finalize();

    // Validate extracted content
    if (!extractedText || extractedText.length < 10) {
      throw new Error("Extracted text is too short or empty");
    }

    // Dynamic chunk sizing based on content size
    let dynamicChunkSize = chunkSize;
    if (extractedText.length > 1000000) {
      // > 1MB
      dynamicChunkSize = Math.max(chunkSize, 10000);
    } else if (extractedText.length > 500000) {
      // > 500KB
      dynamicChunkSize = Math.max(chunkSize, 8000);
    }

    // Chunk text for vector storage
    const textChunks = chunkTextForVector(extractedText, dynamicChunkSize);

    // Create entries for each text chunk
    const entries = textChunks.map((chunk, index) => ({
      id: uuidv4(),
      content: chunk,
      metadata: {
        userId,
        agentId,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        chunkIndex: index,
        totalChunks: textChunks.length,
        isFromFile: true,
        processedAt: new Date().toISOString(),
      },
    }));

    const processingTime = Date.now() - startTime;

    logger.info("Streaming file processing completed", {
      fileId: file.id,
      fileName: file.originalname,
      processingTime,
      textChunks: textChunks.length,
      totalSize: file.size,
      userId,
    });

    return {
      fileId: file.id,
      fileName: file.originalname,
      status: "completed",
      chunks: textChunks.length,
      totalSize: file.size,
      processedSize: extractedText.length,
      entries,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error("Streaming file processing failed", {
      fileId: file.id,
      fileName: file.originalname,
      processingTime,
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
    });

    return {
      fileId: file.id,
      fileName: file.originalname,
      status: "error",
      chunks: 0,
      totalSize: file.size,
      processedSize: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      entries: [],
    };
  }
};

/**
 * Chunk text for vector search (optimized version)
 */
const chunkTextForVector = (text: string, maxLength: number = 5000): string[] => {
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
 * Process multiple streaming files in parallel
 */
export const processMultipleStreamingFiles = async (
  files: StreamingFile[],
  userId: string,
  agentId: string | null,
  chunkSize: number = 5000,
  overlap: number = 200
): Promise<StreamingProcessingResult[]> => {
  logger.info("Starting multiple streaming files processing", {
    fileCount: files.length,
    fileNames: files.map((f) => f.originalname),
    userId,
    agentId,
  });

  // Process all files in parallel
  const processingPromises = files.map((file) =>
    processStreamingFile(file, userId, agentId, chunkSize, overlap)
  );

  const results = await Promise.all(processingPromises);

  const successful = results.filter((r) => r.status === "completed");
  const failed = results.filter((r) => r.status === "error");

  logger.info("Multiple streaming files processing completed", {
    totalFiles: files.length,
    successfulFiles: successful.length,
    failedFiles: failed.length,
    totalChunks: successful.reduce((sum, r) => sum + r.chunks, 0),
    userId,
  });

  return results;
};
