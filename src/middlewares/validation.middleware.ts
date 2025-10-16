/**
 * @file validation.middleware.ts
 * @description Input validation middleware using express-validator
 */

import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { errorResponse } from "../utils/response";

/**
 * Validation middleware to check for validation errors
 * Should be used after validation rules
 */
export const validationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return errorResponse(
      res,
      "Validation failed",
      400,
      errors.array().map((error) => ({
        field: error.type === "field" ? error.path : undefined,
        message: error.msg,
        value: error.type === "field" ? error.value : undefined,
      }))
    );
  }

  next();
};

export default validationMiddleware;
