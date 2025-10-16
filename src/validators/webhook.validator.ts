/**
 * @file webhook.validator.ts
 * @description Validation schemas for webhook endpoints
 */

import { body, param, query } from "express-validator";
// import type { WebhookProvider } from "../types/webhook"; // Type import for future use

/**
 * Validate webhook creation
 */
export const createWebhookValidator = [
  body("agent_id")
    .notEmpty()
    .withMessage("Agent ID is required")
    .isUUID()
    .withMessage("Agent ID must be a valid UUID"),

  body("event_type")
    .notEmpty()
    .withMessage("Event type is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Event type must be between 1-100 characters"),

  body("url")
    .notEmpty()
    .withMessage("Webhook URL is required")
    .isURL()
    .withMessage("Must be a valid URL")
    .isLength({ max: 500 })
    .withMessage("URL must not exceed 500 characters"),

  body("headers")
    .optional()
    .isObject()
    .withMessage("Headers must be an object")
    .custom((headers) => {
      if (headers) {
        const keys = Object.keys(headers);
        if (keys.length > 20) {
          throw new Error("Cannot have more than 20 headers");
        }
        for (const key of keys) {
          if (typeof key !== "string" || typeof headers[key] !== "string") {
            throw new Error("Headers must be string key-value pairs");
          }
          if (key.length > 100 || headers[key].length > 500) {
            throw new Error("Header keys/values too long");
          }
        }
      }
      return true;
    }),
];

/**
 * Validate webhook update
 */
export const updateWebhookValidator = [
  param("id").isUUID().withMessage("Webhook ID must be a valid UUID"),

  body("event_type")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Event type must be between 1-100 characters"),

  body("url")
    .optional()
    .isURL()
    .withMessage("Must be a valid URL")
    .isLength({ max: 500 })
    .withMessage("URL must not exceed 500 characters"),

  body("headers")
    .optional()
    .isObject()
    .withMessage("Headers must be an object")
    .custom((headers) => {
      if (headers) {
        const keys = Object.keys(headers);
        if (keys.length > 20) {
          throw new Error("Cannot have more than 20 headers");
        }
        for (const key of keys) {
          if (typeof key !== "string" || typeof headers[key] !== "string") {
            throw new Error("Headers must be string key-value pairs");
          }
          if (key.length > 100 || headers[key].length > 500) {
            throw new Error("Header keys/values too long");
          }
        }
      }
      return true;
    }),
];

/**
 * Validate webhook ID parameter
 */
export const webhookIdValidator = [
  param("id").isUUID().withMessage("Webhook ID must be a valid UUID"),
];

/**
 * Validate agent ID parameter
 */
export const agentIdValidator = [
  param("agentId").isUUID().withMessage("Agent ID must be a valid UUID"),
];

/**
 * Validate webhook processing request
 */
export const processWebhookValidator = [
  param("provider")
    .isIn(["stripe", "supabase", "github", "pinecone", "custom"])
    .withMessage("Invalid webhook provider"),

  body().custom((_body, { req }) => {
    const contentType = req?.headers?.["content-type"];
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Content-Type must be application/json");
    }
    return true;
  }),
];

/**
 * Validate webhook listing query parameters
 */
export const listWebhooksValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer").toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1-100")
    .toInt(),

  query("event_type")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Event type filter must be between 1-100 characters"),
];

/**
 * Validate webhook test request
 */
export const testWebhookValidator = [
  param("id").isUUID().withMessage("Webhook ID must be a valid UUID"),

  body("test_data").optional().isObject().withMessage("Test data must be an object"),
];

export default {
  createWebhookValidator,
  updateWebhookValidator,
  webhookIdValidator,
  agentIdValidator,
  processWebhookValidator,
  listWebhooksValidator,
  testWebhookValidator,
};
