/**
 * @file knowledge.validator.ts
 * @description Validation schemas for knowledge base endpoints
 * Handles validation for knowledge entry management
 */

import { body, param, query } from "express-validator";

/**
 * Validate knowledge ID parameter
 */
export const knowledgeIdValidator = [
  param("id")
    .isUUID()
    .withMessage("Knowledge ID must be a valid UUID")
    .notEmpty()
    .withMessage("Knowledge ID is required"),
];

/**
 * Validate create knowledge request
 */
export const createKnowledgeValidator = [
  body("title")
    .isString()
    .withMessage("Title must be a string")
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters")
    .trim()
    .notEmpty()
    .withMessage("Title is required"),

  body("content")
    .isString()
    .withMessage("Content must be a string")
    .isLength({ min: 10, max: 50000 })
    .withMessage("Content must be between 10 and 50000 characters")
    .trim()
    .notEmpty()
    .withMessage("Content is required"),

  body("metadata").optional().isObject().withMessage("Metadata must be an object"),

  body("agentId").optional().isUUID().withMessage("Agent ID must be a valid UUID"),
];

/**
 * Validate update knowledge request
 */
export const updateKnowledgeValidator = [
  body("title")
    .optional()
    .isString()
    .withMessage("Title must be a string")
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters")
    .trim(),

  body("content")
    .optional()
    .isString()
    .withMessage("Content must be a string")
    .isLength({ min: 10, max: 50000 })
    .withMessage("Content must be between 10 and 50000 characters")
    .trim(),

  body("metadata").optional().isObject().withMessage("Metadata must be an object"),
];

/**
 * Validate search knowledge request
 */
export const searchKnowledgeValidator = [
  body("query")
    .isString()
    .withMessage("Query must be a string")
    .isLength({ min: 1, max: 1000 })
    .withMessage("Query must be between 1 and 1000 characters")
    .trim()
    .notEmpty()
    .withMessage("Query is required"),

  body("topK")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("topK must be an integer between 1 and 50"),

  body("agentId").optional().isUUID().withMessage("Agent ID must be a valid UUID"),
];

/**
 * Validate pagination query parameters
 */
export const paginationValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),

  query("perPage")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("PerPage must be an integer between 1 and 100"),
];

/**
 * Validate knowledge list query parameters
 */
export const knowledgeListValidator = [
  ...paginationValidator,

  query("agentId").optional().isUUID().withMessage("Agent ID must be a valid UUID"),
];

/**
 * Combined validator for create knowledge endpoint
 */
export const createKnowledgeEndpointValidator = createKnowledgeValidator;

/**
 * Combined validator for update knowledge endpoint
 */
export const updateKnowledgeEndpointValidator = [
  ...knowledgeIdValidator,
  ...updateKnowledgeValidator,
];

/**
 * Combined validator for get knowledge by ID endpoint
 */
export const getKnowledgeByIdValidator = knowledgeIdValidator;

/**
 * Combined validator for delete knowledge endpoint
 */
export const deleteKnowledgeValidator = knowledgeIdValidator;

/**
 * Combined validator for search knowledge endpoint
 */
export const searchKnowledgeEndpointValidator = searchKnowledgeValidator;

/**
 * Validate file upload request
 */
export const fileUploadValidator = [
  body("title")
    .optional()
    .isString()
    .withMessage("Title must be a string")
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters")
    .trim(),

  body("agentId").optional().isUUID().withMessage("Agent ID must be a valid UUID"),

  body("chunkSize")
    .optional()
    .isInt({ min: 100, max: 5000 })
    .withMessage("Chunk size must be between 100 and 5000 characters"),

  body("overlap")
    .optional()
    .isInt({ min: 0, max: 500 })
    .withMessage("Overlap must be between 0 and 500 characters"),
];

/**
 * Validate multiple file upload request
 */
export const multipleFileUploadValidator = [
  body("agentId").optional().isUUID().withMessage("Agent ID must be a valid UUID"),

  body("chunkSize")
    .optional()
    .isInt({ min: 100, max: 5000 })
    .withMessage("Chunk size must be between 100 and 5000 characters"),

  body("overlap")
    .optional()
    .isInt({ min: 0, max: 500 })
    .withMessage("Overlap must be between 0 and 500 characters"),
];

/**
 * Combined validator for single file upload endpoint
 */
export const uploadFileEndpointValidator = fileUploadValidator;

/**
 * Combined validator for multiple file upload endpoint
 */
export const uploadMultipleFilesEndpointValidator = multipleFileUploadValidator;
