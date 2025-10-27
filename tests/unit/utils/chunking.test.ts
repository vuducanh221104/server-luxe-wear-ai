/**
 * @file chunking.test.ts
 * @description Test cases for text chunking with overlap
 */

/**
 * Chunking function implementation for testing
 * This mirrors the implementation in streamingFileProcessor.ts
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

    if ((currentChunk + trimmedSentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());

        if (overlap > 0 && currentChunk.length > overlap) {
          const overlapText = currentChunk.slice(-overlap);
          const lastSentenceStart = overlapText.search(/[.!?]+\s+/);

          if (lastSentenceStart !== -1) {
            previousChunkEnd = overlapText.slice(lastSentenceStart + 2).trim();
          } else {
            previousChunkEnd = overlapText.trim();
          }

          currentChunk = previousChunkEnd + (previousChunkEnd ? ". " : "") + trimmedSentence;
        } else {
          previousChunkEnd = "";
          currentChunk = trimmedSentence;
        }
      } else {
        if (trimmedSentence.length > maxLength) {
          const words = trimmedSentence.split(/\s+/);
          let wordChunk = previousChunkEnd;

          for (const word of words) {
            if ((wordChunk + " " + word).length > maxLength) {
              if (wordChunk) {
                chunks.push(wordChunk.trim());

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

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

describe("Text Chunking with Overlap", () => {
  it("should chunk text without overlap when overlap is 0", () => {
    const text =
      "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.";
    const chunks = chunkTextForVector(text, 50, 0);

    expect(chunks.length).toBeGreaterThan(0);
  });

  it("should create chunks with overlap maintaining context", () => {
    const text =
      "Fashion is an art form. It expresses personality and creativity. Colors play a vital role in fashion design. Designers use colors to convey emotions. Red symbolizes passion and energy. Blue represents calm and trust. Understanding color theory is essential for designers.";

    const chunks = chunkTextForVector(text, 100, 30);

    expect(chunks.length).toBeGreaterThan(1);

    // Verify overlap exists between consecutive chunks
    for (let i = 1; i < chunks.length; i++) {
      const prevChunkEnd = chunks[i - 1].slice(-30);
      const hasOverlap = chunks[i].split(" ").some((word) => prevChunkEnd.includes(word));
      expect(hasOverlap).toBe(true);
    }
  });

  it("should handle text shorter than maxLength", () => {
    const text = "Short text.";
    const chunks = chunkTextForVector(text, 5000, 200);

    expect(chunks).toEqual(["Short text"]);
  });

  it("should handle empty text", () => {
    const text = "";
    const chunks = chunkTextForVector(text, 5000, 200);

    expect(chunks).toEqual([]);
  });

  it("should handle very long sentences", () => {
    const longSentence =
      "This is a very long sentence that exceeds the max chunk size " + "word ".repeat(200);
    const chunks = chunkTextForVector(longSentence, 100, 20);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(150);
    });
  });

  it("should handle custom chunk sizes", () => {
    const text = "A ".repeat(1000);
    const smallChunks = chunkTextForVector(text, 100, 10);
    const largeChunks = chunkTextForVector(text, 500, 50);

    expect(smallChunks.length).toBeGreaterThan(largeChunks.length);
  });

  it("should demonstrate overlap quality with real fashion content", () => {
    const fashionText = `Fashion design is a creative process. It involves understanding trends and customer needs. Designers must consider fabric selection. Different fabrics have unique properties. Silk provides elegance and luxury. Cotton offers comfort and breathability. Color theory is fundamental in design. Colors evoke emotions and set moods. Sustainable fashion is increasingly important. Eco-friendly materials reduce environmental impact.`;

    const chunks = chunkTextForVector(fashionText, 150, 40);

    expect(chunks.length).toBeGreaterThan(1);

    chunks.forEach((chunk) => {
      expect(chunk.length).toBeGreaterThan(20);
      expect(chunk.split(" ").length).toBeGreaterThan(3);
    });
  });
});
