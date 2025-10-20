/**
 * @file auth.validator.ts
 * @description Validation schemas for authentication endpoints
 */

import { body, ValidationChain } from "express-validator";

/**
 * Validator for user registration
 */
export const registerValidator: ValidationChain[] = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Email must be valid")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("role")
    .optional()
    .isIn(["member", "admin", "owner", "super_admin"])
    .withMessage("Role must be one of: member, admin, owner, super_admin"),
];

/**
 * Validator for user login
 */
export const loginValidator: ValidationChain[] = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Email must be valid")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),
];

/**
 * Validator for forgot password
 */
export const forgotPasswordValidator: ValidationChain[] = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Email must be valid")
    .normalizeEmail(),
];

/**
 * Validator for reset password
 */
export const resetPasswordValidator: ValidationChain[] = [
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
 * Validator for refresh token
 */
export const refreshTokenValidator: ValidationChain[] = [
  body("refreshToken").notEmpty().withMessage("Refresh token is required"),
];

/**
 * Validator for change password
 */
export const changePasswordValidator: ValidationChain[] = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
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
 * Validator for verify email
 */
export const verifyEmailValidator: ValidationChain[] = [
  body("token").notEmpty().withMessage("Verification token is required"),
];

/**
 * Validator for requesting a verification email
 */
export const requestVerifyEmailValidator: ValidationChain[] = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Email must be valid")
    .normalizeEmail(),
];

/**
 * Validator for resetting password using reset token
 */
export const resetPasswordWithTokenValidator: ValidationChain[] = [
  body("token").notEmpty().withMessage("Reset token is required"),
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
