/**
 * @file response.ts
 * @description Standard response utilities for consistent API responses
 */

import { Response } from "express";

/**
 * Success response structure
 */
interface SuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * Error response structure
 */
interface ErrorResponse {
  success: false;
  message: string;
  errors?: unknown[];
  timestamp: string;
}

/**
 * Send a success response
 * @param res - Express response object
 * @param data - Response data payload
 * @param message - Success message
 * @param statusCode - HTTP status code (default 200)
 */
export const successResponse = <T = unknown>(
  res: Response,
  data: T,
  message: string = "Success",
  statusCode: number = 200
): Response<SuccessResponse<T>> => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send an error response
 * @param res - Express response object
 * @param message - Error message
 * @param statusCode - HTTP status code (default 500)
 * @param errors - Optional array of error details
 */
export const errorResponse = (
  res: Response,
  message: string = "An error occurred",
  statusCode: number = 500,
  errors?: unknown[]
): Response<ErrorResponse> => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    timestamp: new Date().toISOString(),
  });
};
