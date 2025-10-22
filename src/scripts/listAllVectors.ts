/**
 * @file list-all-vectors.ts
 * @description List all vectors in Pinecone index
 */

import dotenv from "dotenv";
dotenv.config();

import { Pinecone } from "@pinecone-database/pinecone";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "agent";

async function listAllVectors() {
  try {
    if (!PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is required");
    }

    console.log("🔍 Connecting to Pinecone...");
    const pc = new Pinecone({
      apiKey: PINECONE_API_KEY,
    });

    const index = pc.index(PINECONE_INDEX_NAME);

    // Get index stats
    console.log("\n📊 Index Statistics:");
    const stats = await index.describeIndexStats();
    console.log(`Total vectors: ${stats.totalRecordCount}`);
    console.log(`Dimensions: ${stats.dimension}`);

    // Query to list ALL vectors (using dummy vector)
    console.log("\n📋 Fetching all vectors...");
    const queryResult = await index.query({
      vector: new Array(1024).fill(0), // Dummy vector
      topK: 10000, // Get up to 10,000 records
      includeMetadata: true,
      includeValues: false, // Don't include vectors to save bandwidth
    });

    console.log(`\n✅ Found ${queryResult.matches?.length || 0} vectors:\n`);
    console.log("─".repeat(100));

    // Display all vectors
    queryResult.matches?.forEach((match, idx) => {
      console.log(`${idx + 1}. ID: ${match.id}`);
      console.log(`   Score: ${match.score?.toFixed(4)}`);
      console.log(`   File: ${match.metadata?.fileName || "N/A"}`);
      console.log(
        `   Chunk: ${match.metadata?.chunkIndex || "N/A"} / ${match.metadata?.totalChunks || "N/A"}`
      );
      console.log(`   Title: ${match.metadata?.title || "N/A"}`);
      console.log(
        `   Content preview: ${(match.metadata?.content as string)?.substring(0, 100) || "N/A"}...`
      );
      console.log("─".repeat(100));
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Total records in index: ${stats.totalRecordCount}`);
    console.log(`   Records fetched: ${queryResult.matches?.length || 0}`);

    // Group by file
    const fileGroups = queryResult.matches?.reduce(
      (acc, match) => {
        const fileName = (match.metadata?.fileName as string) || "Unknown";
        if (!acc[fileName]) {
          acc[fileName] = 0;
        }
        acc[fileName]++;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log(`\n📁 Vectors by file:`);
    Object.entries(fileGroups || {}).forEach(([fileName, count]) => {
      console.log(`   ${fileName}: ${count} chunks`);
    });
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the script
listAllVectors()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
