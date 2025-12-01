/**
 * @file streaming-file-processor.ts
 * @description Streaming file processing utilities
 * Handles chunked text extraction and processing for large files
 */

import { v4 as uuidv4 } from "uuid";
import {
  StreamingFile,
  StreamingProcessingResult,
  ChunkProcessor,
  ChunkMetadata,
  SUPPORTED_FILE_TYPES,
} from "../types/upload";
import logger from "../config/logger";

// Re-export types for backward compatibility
export type { StreamingFile, StreamingProcessingResult, ChunkProcessor, ChunkMetadata };

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

      const extractedText = data.text.trim();

      logger.info("PDF text extraction completed", {
        fileId: this.metadata.fileId,
        fileName: this.metadata.fileName,
        pageCount: data.numpages,
        textLength: extractedText.length,
        chunksProcessed: this.chunks.length,
      });

      // Always try OCR if text is minimal or if PDF might contain images
      // Lower threshold to catch more image-based PDFs
      const shouldTryOCR = extractedText.length < 100 || 
                          (extractedText.length < 200 && data.numpages > 1);
      
      if (shouldTryOCR) {
        logger.info("PDF may contain images, attempting OCR for better text extraction", {
          fileId: this.metadata.fileId,
          fileName: this.metadata.fileName,
          textLength: extractedText.length,
          pageCount: data.numpages,
        });

        // Try OCR using tesseract.js if available
        try {
          const ocrText = await this.extractTextWithOCR(fullBuffer, data.numpages);
          if (ocrText && ocrText.length > 20) {
            // If OCR extracted significantly more text, use it
            if (ocrText.length > extractedText.length * 1.5 || extractedText.length < 50) {
              logger.info("OCR extraction successful - using OCR text", {
                fileId: this.metadata.fileId,
                fileName: this.metadata.fileName,
                ocrTextLength: ocrText.length,
                originalTextLength: extractedText.length,
                improvement: `${((ocrText.length / Math.max(extractedText.length, 1) - 1) * 100).toFixed(1)}%`,
              });
              return ocrText;
            } else {
              // Combine both texts if OCR found additional content
              const combinedText = extractedText + "\n\n" + ocrText;
              logger.info("Combining original and OCR text", {
                fileId: this.metadata.fileId,
                fileName: this.metadata.fileName,
                originalLength: extractedText.length,
                ocrLength: ocrText.length,
                combinedLength: combinedText.length,
              });
              return combinedText;
            }
          } else {
            logger.warn("OCR did not extract sufficient text", {
              fileId: this.metadata.fileId,
              fileName: this.metadata.fileName,
              ocrTextLength: ocrText?.length || 0,
            });
          }
        } catch (ocrError) {
          logger.warn("OCR extraction failed or not available", {
            fileId: this.metadata.fileId,
            fileName: this.metadata.fileName,
            error: ocrError instanceof Error ? ocrError.message : "Unknown OCR error",
          });
          // Continue with original text if OCR fails
        }

        // If OCR failed and we have minimal text, throw error
        if (extractedText.length < 10) {
          throw new Error(
            "PDF appears to be image-only and OCR extraction failed. " +
            "Please ensure the PDF contains extractable text or use a PDF with embedded text layer."
          );
        }
      }

      return extractedText;
    } catch (error) {
      logger.error("PDF streaming processing failed", {
        fileId: this.metadata?.fileId,
        fileName: this.metadata?.fileName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Extract text from PDF images using OCR
   * This method extracts images from PDF pages and uses Tesseract.js for OCR
   * Falls back gracefully if OCR libraries are not available
   */
  private async extractTextWithOCR(pdfBuffer: Buffer, pageCount: number): Promise<string> {
    try {
      // Dynamic import to avoid loading if not needed
      let pdfjsLib: any;
      let createWorker: any;
      let Canvas: any;

      try {
        pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const tesseract = await import("tesseract.js");
        createWorker = tesseract.createWorker;
        Canvas = require("canvas");
      } catch (importError) {
        logger.warn("OCR dependencies not available", {
          error: importError instanceof Error ? importError.message : "Unknown error",
        });
        throw new Error("OCR dependencies not available");
      }

      // Set up PDF.js worker (required for pdfjs-dist in Node.js)
      // In Node.js, we need to set the worker path
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfjsWorkerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerPath;
      } catch (workerError) {
        logger.warn("Could not set PDF.js worker path, continuing without worker", {
          error: workerError instanceof Error ? workerError.message : "Unknown error",
        });
        // Continue without worker - may work for simple PDFs
      }

      const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
      const ocrTexts: string[] = [];

      // Increase page limit for better coverage (up to 20 pages)
      // Process more pages for better text extraction
      const maxPages = Math.min(pageCount, 20);

      logger.info("Starting OCR processing", {
        fileId: this.metadata?.fileId,
        fileName: this.metadata?.fileName,
        totalPages: pageCount,
        processingPages: maxPages,
      });

      // Create Tesseract worker with multi-language support
      // Try English + Vietnamese, fallback to English only if Vietnamese not available
      let worker: any;
      try {
        worker = await createWorker("eng+vie", 1);
        logger.info("OCR worker created with English + Vietnamese support");
      } catch (langError) {
        logger.warn("Vietnamese language pack not available, using English only", {
          error: langError instanceof Error ? langError.message : "Unknown error",
        });
        worker = await createWorker("eng", 1);
      }

      // Configure OCR for better accuracy
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: "1", // Automatic page segmentation with OSD
          preserve_interword_spaces: "1", // Preserve spaces
        });
      } catch (paramError) {
        logger.warn("Could not set OCR parameters, using defaults", {
          error: paramError instanceof Error ? paramError.message : "Unknown error",
        });
      }

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          // Increase scale for better OCR accuracy (3.0 instead of 2.0)
          const viewport = page.getViewport({ scale: 3.0 });

          // Render page to canvas with higher resolution
          const canvas = Canvas.createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext("2d");

          // Improve image quality for OCR
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          await page.render(renderContext).promise;

          // Convert canvas to image buffer with high quality
          const imageBuffer = canvas.toBuffer("image/png", { 
            compressionLevel: 1, // Higher quality
          });

          // Perform OCR on the image with better settings
          const { data: ocrResult } = await worker.recognize(imageBuffer, {
            rectangle: undefined, // Process entire page
          });

          if (ocrResult.text && ocrResult.text.trim().length > 0) {
            const pageText = ocrResult.text.trim();
            ocrTexts.push(pageText);
            logger.info(`OCR extracted ${pageText.length} characters from page ${pageNum}/${maxPages}`, {
              fileId: this.metadata?.fileId,
              fileName: this.metadata?.fileName,
              pageNum,
              confidence: ocrResult.confidence ? `${ocrResult.confidence.toFixed(1)}%` : "unknown",
            });
          } else {
            logger.debug(`No text extracted from page ${pageNum}`);
          }
        } catch (pageError) {
          logger.warn(`Failed to OCR page ${pageNum}`, {
            fileId: this.metadata?.fileId,
            fileName: this.metadata?.fileName,
            pageNum,
            error: pageError instanceof Error ? pageError.message : "Unknown error",
          });
          // Continue with next page
        }
      }

      await worker.terminate();

      const combinedText = ocrTexts.join("\n\n");
      
      logger.info("OCR processing completed", {
        fileId: this.metadata?.fileId,
        fileName: this.metadata?.fileName,
        pagesProcessed: ocrTexts.length,
        totalTextLength: combinedText.length,
      });

      return combinedText;
    } catch (error) {
      logger.error("OCR extraction failed", {
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
  overlap: number = 200
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

    // Chunk text for vector storage with overlap
    const textChunks = chunkTextForVector(extractedText, dynamicChunkSize, overlap);

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
 * Chunk text for vector search with overlap support
 * Improved version that maintains context between chunks
 *
 * @param text - Full text to chunk
 * @param maxLength - Maximum characters per chunk (default: 5000)
 * @param overlap - Overlap characters between chunks for context preservation (default: 200)
 * @returns Array of text chunks with overlap
 */
const chunkTextForVector = (
  text: string,
  maxLength: number = 5000,
  overlap: number = 200
): string[] => {
  const sentences = text.split(/[.!?]+\s+/);
  const chunks: string[] = [];
  let currentChunk = "";
  let previousChunkEnd = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    // Check if adding sentence exceeds max length
    if ((currentChunk + trimmedSentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());

        // Extract overlap from end of current chunk for next chunk
        if (overlap > 0 && currentChunk.length > overlap) {
          // Find last complete sentence within overlap range
          const overlapText = currentChunk.slice(-overlap);
          const lastSentenceStart = overlapText.search(/[.!?]+\s+/);

          if (lastSentenceStart !== -1) {
            previousChunkEnd = overlapText.slice(lastSentenceStart + 2).trim();
          } else {
            // If no sentence boundary, use character-based overlap
            previousChunkEnd = overlapText.trim();
          }

          currentChunk = previousChunkEnd + (previousChunkEnd ? ". " : "") + trimmedSentence;
        } else {
          previousChunkEnd = "";
          currentChunk = trimmedSentence;
        }
      } else {
        // Sentence itself is too long - need to split it
        if (trimmedSentence.length > maxLength) {
          const words = trimmedSentence.split(/\s+/);
          let wordChunk = previousChunkEnd;

          for (const word of words) {
            if ((wordChunk + " " + word).length > maxLength) {
              if (wordChunk) {
                chunks.push(wordChunk.trim());

                // Use overlap for word-level chunks too
                if (overlap > 0 && wordChunk.length > overlap) {
                  wordChunk = wordChunk.slice(-overlap).trim() + " " + word;
                } else {
                  wordChunk = word;
                }
              } else {
                wordChunk = word;
              }
            } else {
              wordChunk += (wordChunk ? " " : "") + word;
            }
          }
          currentChunk = wordChunk;
        } else {
          currentChunk = trimmedSentence;
        }
      }
    } else {
      currentChunk += (currentChunk ? ". " : "") + trimmedSentence;
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  logger.debug("Text chunking completed", {
    totalChunks: chunks.length,
    avgChunkSize: chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length,
    overlapUsed: overlap,
  });

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
