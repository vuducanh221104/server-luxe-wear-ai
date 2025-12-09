/**
 * @file agent.validator.ts
 * @description Validation schemas for agent endpoints
 */

import { body, param, query, ValidationChain } from "express-validator";

/**
 * Validator for creating agent
 */
export const createAgentValidator: ValidationChain[] = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Agent name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Agent name must be between 3 and 100 characters")
    .matches(/^[\p{L}\p{N}\s\-_]+$/u)
    .withMessage("Agent name can only contain letters, numbers, spaces, hyphens, and underscores"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),

  body("config").optional().isObject().withMessage("Config must be an object"),

  body("config.model").optional().isString().withMessage("Model must be a string"),

  body("config.temperature")
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage("Temperature must be between 0 and 2"),

  body("config.maxTokens")
    .optional()
    .isInt({ min: 1, max: 4096 })
    .withMessage("Max tokens must be between 1 and 4096"),

  body("config.systemPrompt")
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage("System prompt must not exceed 2000 characters"),

  body("config.instructions")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Instructions must not exceed 1000 characters"),

  body("config.tools").optional().isArray().withMessage("Tools must be an array"),
];

/**
 * Validator for updating agent
 */
export const updateAgentValidator: ValidationChain[] = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Agent name must be between 3 and 100 characters")
    .matches(/^[\p{L}\p{N}\s\-_]+$/u)
    .withMessage("Agent name can only contain letters, numbers, spaces, hyphens, and underscores"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),

  body("config").optional().isObject().withMessage("Config must be an object"),

  body("config.model").optional().isString().withMessage("Model must be a string"),

  body("config.temperature")
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage("Temperature must be between 0 and 2"),

  body("config.maxTokens")
    .optional()
    .isInt({ min: 1, max: 4096 })
    .withMessage("Max tokens must be between 1 and 4096"),

  body("config.systemPrompt")
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage("System prompt must not exceed 2000 characters"),

  body("config.instructions")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Instructions must not exceed 1000 characters"),

  body("config.tools").optional().isArray().withMessage("Tools must be an array"),
];

/**
 * Validator for agent ID parameter
 */
export const agentIdValidator: ValidationChain[] = [
  param("agentId")
    .notEmpty()
    .withMessage("Agent ID is required")
    .isUUID()
    .withMessage("Agent ID must be a valid UUID"),
];

/**
 * Validator for pagination query parameters
 */
export const paginationValidator: ValidationChain[] = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer").toInt(),

  query("perPage")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Per page must be between 1 and 50")
    .toInt(),
];

/**
 * Validator for search query
 */
export const searchValidator: ValidationChain[] = [
  query("q")
    .trim()
    .notEmpty()
    .withMessage("Search query is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Search query must be between 2 and 100 characters"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Limit must be between 1 and 20")
    .toInt(),
];

/**
 * Validator for chat request
 */
export const chatValidator: ValidationChain[] = [
  body("message")
    .trim()
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ min: 1, max: 4000 })
    .withMessage("Message must be between 1 and 4000 characters"),

  body("context")
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage("Context must be a string with max 2000 characters"),

  body("useTools").optional().isBoolean().withMessage("useTools must be a boolean value"),

  body("enabledTools")
    .optional()
    .isArray()
    .withMessage("enabledTools must be an array")
    .custom((value: string[]) => {
      if (value && value.length > 20) {
        throw new Error("Maximum 20 tools can be enabled");
      }
      if (value && value.some((tool: string) => typeof tool !== "string" || tool.length > 50)) {
        throw new Error("Each tool name must be a string with max 50 characters");
      }
      return true;
    }),
];

/**
 * Validator for toggling agent public status
 */
export const togglePublicValidator: ValidationChain[] = [
  body("isPublic").isBoolean().withMessage("isPublic must be a boolean value"),

  body("allowedOrigins")
    .optional()
    .isArray()
    .withMessage("allowedOrigins must be an array")
    .custom((value: string[]) => {
      if (value && value.length > 10) {
        throw new Error("Maximum 10 allowed origins");
      }
      if (
        value &&
        value.some((origin: string) => typeof origin !== "string" || origin.length > 100)
      ) {
        throw new Error("Each origin must be a string with max 100 characters");
      }
      return true;
    }),
];

/**
 * Validator for getting user agents (Admin only)
 */
export const getUserAgentsValidator: ValidationChain[] = [
  param("userId").isUUID().withMessage("User ID must be a valid UUID"),
  ...paginationValidator,
];
