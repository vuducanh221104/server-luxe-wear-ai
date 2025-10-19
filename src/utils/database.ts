/**
 * @file database.ts
 * @description Database utilities with error handling
 */

import { handleAsyncOperationWithRetry, handleBatchOperations } from "./errorHandler";
import logger from "../config/logger";

// Mock database connection for demo
class DatabaseConnection {
  private isConnected = false;

  async connect(): Promise<void> {
    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.isConnected = true;
    logger.info("Database connected");
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    logger.info("Database disconnected");
  }

  async query(_sql: string, _params?: any[]): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error("Database not connected");
    }

    // Simulate query execution
    await new Promise((resolve) => setTimeout(resolve, 50));
    return [{ id: 1, result: "mock data" }];
  }

  async transaction(operations: Array<() => Promise<any>>): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error("Database not connected");
    }

    logger.info("Starting database transaction", { operationCount: operations.length });

    // Execute all operations in batch with error handling
    const results = await handleBatchOperations(operations, "database transaction", {
      context: { operationCount: operations.length },
    });

    logger.info("Database transaction completed", {
      successful: results.length,
      total: operations.length,
    });

    return results;
  }
}

export class DatabaseService {
  private db = new DatabaseConnection();

  /**
   * Connect to database with retry
   */
  async connect(): Promise<void> {
    return handleAsyncOperationWithRetry(
      () => this.db.connect(),
      "connect to database",
      3, // max retries
      1000, // base delay
      {
        context: { service: "database" },
      }
    );
  }

  /**
   * Execute query with retry
   */
  async query(sql: string, params?: any[]): Promise<any[]> {
    return handleAsyncOperationWithRetry(
      () => this.db.query(sql, params),
      "execute database query",
      2, // max retries
      500, // base delay
      {
        context: { sql: sql.substring(0, 50), paramCount: params?.length || 0 },
      }
    );
  }

  /**
   * Execute transaction
   */
  async transaction(operations: Array<() => Promise<any>>): Promise<any[]> {
    return handleAsyncOperationWithRetry(
      () => this.db.transaction(operations),
      "execute database transaction",
      1, // max retries
      1000, // base delay
      {
        context: { operationCount: operations.length },
      }
    );
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    return handleAsyncOperationWithRetry(
      () => this.db.disconnect(),
      "disconnect from database",
      2,
      500,
      {
        context: { service: "database" },
      }
    );
  }
}

export const databaseService = new DatabaseService();
