/**
 * @file user.validator.ts
 * @description Validation schemas for user endpoints
 */

import { body, param, query, ValidationChain } from "express-validator";

/**
 * Validator for updating user profile
 */
export const updateProfileValidator: ValidationChain[] = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("phone")
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true; // Allow empty
      // Allow various phone formats: +1234567890, 123-456-7890, (123) 456-7890, etc.
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$|^[\+]?[1-9][\d\s\-\(\)]{7,20}$/;
      return phoneRegex.test(value);
    })
    .withMessage("Phone number must be valid (e.g., +1234567890, 123-456-7890)"),

  body("website")
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true; // Allow empty
      // Check if it's a valid URL with protocol
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    })
    .withMessage("Website must be a valid URL with protocol (http/https)"),

  // Note: avatar_url validation removed - will be handled by file upload middleware
];

/**
 * Validator for updating user email
 */
export const updateEmailValidator: ValidationChain[] = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Email must be valid")
    .normalizeEmail(),
];

/**
 * Validator for updating user password (admin)
 */
export const updatePasswordValidator: ValidationChain[] = [
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "New password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
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
    .isInt({ min: 1, max: 100 })
    .withMessage("Per page must be between 1 and 100")
    .toInt(),
];

/**
 * Validator for updating user by ID (admin)
 */
export const updateUserByIdValidator: ValidationChain[] = [
  ...userIdValidator,
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("phone")
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true;
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$|^[\+]?[1-9][\d\s\-\(\)]{7,20}$/;
      return phoneRegex.test(value);
    })
    .withMessage("Phone number must be valid"),

  body("website")
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    })
    .withMessage("Website must be a valid URL"),

  body("role")
    .optional()
    .isIn(["member", "admin", "owner", "super_admin"])
    .withMessage("Role must be one of: member, admin, owner, super_admin"),

  body("is_active").optional().isBoolean().withMessage("is_active must be boolean").toBoolean(),

  body("email_verified")
    .optional()
    .isBoolean()
    .withMessage("email_verified must be boolean")
    .toBoolean(),
];

/**
 * Validator for ban user
 */
export const banUserValidator: ValidationChain[] = [
  ...userIdValidator,
  body("banned").isBoolean().withMessage("Banned must be a boolean value").toBoolean(),
];
