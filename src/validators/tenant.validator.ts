/**
 * @file tenant.validator.ts
 * @description Validation schemas for tenant endpoints
 */

import { body, param, query, ValidationChain } from "express-validator";

/**
 * Validator for creating tenant
 */
export const createTenantValidator: ValidationChain[] = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Tenant name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Tenant name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage("Tenant name can only contain letters, numbers, spaces, hyphens, and underscores"),

  body("plan")
    .optional()
    .isIn(["free", "pro", "enterprise"])
    .withMessage("Plan must be one of: free, pro, enterprise"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "suspended"])
    .withMessage("Status must be one of: active, inactive, suspended"),
];

/**
 * Validator for updating tenant
 */
export const updateTenantValidator: ValidationChain[] = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Tenant name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage("Tenant name can only contain letters, numbers, spaces, hyphens, and underscores"),

  body("plan")
    .optional()
    .isIn(["free", "pro", "enterprise"])
    .withMessage("Plan must be one of: free, pro, enterprise"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "suspended"])
    .withMessage("Status must be one of: active, inactive, suspended"),
];

/**
 * Validator for tenant ID parameter
 */
export const tenantIdValidator: ValidationChain[] = [
  param("tenantId")
    .notEmpty()
    .withMessage("Tenant ID is required")
    .isUUID()
    .withMessage("Tenant ID must be a valid UUID"),
];

/**
 * Validator for adding user to tenant
 */
export const addUserToTenantValidator: ValidationChain[] = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isUUID()
    .withMessage("User ID must be a valid UUID"),

  body("role")
    .optional()
    .isIn(["admin", "member"])
    .withMessage("Role must be one of: admin, member"),
];

/**
 * Validator for updating user role in tenant
 */
export const updateUserTenantRoleValidator: ValidationChain[] = [
  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["admin", "member"])
    .withMessage("Role must be one of: admin, member"),
];

/**
 * Validator for user ID parameter
 */
export const userIdValidator: ValidationChain[] = [
  param("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isUUID()
    .withMessage("User ID must be a valid UUID"),
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
 * Combined validator for create tenant endpoint
 */
export const createTenantEndpointValidator = createTenantValidator;

/**
 * Combined validator for update tenant endpoint
 */
export const updateTenantEndpointValidator = [...tenantIdValidator, ...updateTenantValidator];

/**
 * Combined validator for get tenant by ID endpoint
 */
export const getTenantByIdValidator = tenantIdValidator;

/**
 * Combined validator for delete tenant endpoint
 */
export const deleteTenantValidator = tenantIdValidator;

/**
 * Combined validator for add user to tenant endpoint
 */
export const addUserToTenantEndpointValidator = [...tenantIdValidator, ...addUserToTenantValidator];

/**
 * Combined validator for update user role in tenant endpoint
 */
export const updateUserTenantRoleEndpointValidator = [
  ...tenantIdValidator,
  ...userIdValidator,
  ...updateUserTenantRoleValidator,
];

/**
 * Combined validator for remove user from tenant endpoint
 */
export const removeUserFromTenantEndpointValidator = [...tenantIdValidator, ...userIdValidator];

/**
 * Combined validator for get tenant members endpoint
 */
export const getTenantMembersEndpointValidator = tenantIdValidator;

/**
 * Combined validator for get tenant stats endpoint
 */
export const getTenantStatsEndpointValidator = tenantIdValidator;
