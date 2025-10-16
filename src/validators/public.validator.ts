/**
 * @file public.validator.ts
 * @description Validation schemas for public API endpoints
 * Handles validation for public agent access without authentication
 */

import { body, param } from "express-validator";

/**
 * Validate agent ID parameter for public routes
 */
export const publicAgentIdValidator = [
  param("agentId")
    .isUUID()
    .withMessage("Agent ID must be a valid UUID")
    .notEmpty()
    .withMessage("Agent ID is required"),
];

/**
 * Validate chat request for public agent
 */
export const publicChatValidator = [
  body("message")
    .isString()
    .withMessage("Message must be a string")
    .isLength({ min: 1, max: 10000 })
    .withMessage("Message must be between 1 and 10000 characters")
    .trim()
    .notEmpty()
    .withMessage("Message is required"),

  body("context")
    .optional()
    .isString()
    .withMessage("Context must be a string")
    .isLength({ max: 5000 })
    .withMessage("Context must not exceed 5000 characters")
    .trim(),
];

/**
 * Combined validator for public agent chat endpoint
 */
export const publicAgentChatValidator = [...publicAgentIdValidator, ...publicChatValidator];

/**
 * Validator for getting public agent details
 */
export const publicAgentDetailsValidator = publicAgentIdValidator;
