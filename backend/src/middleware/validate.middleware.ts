// ============================================
// VALIDATION MIDDLEWARE

// ============================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { HTTP_STATUS } from '../constants';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Middleware factory that validates request data against a Zod schema
 */
export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[target];
      const result = schema.parse(dataToValidate);

      // Replace with validated (and potentially transformed) data
      req[target] = result;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((err: ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Doğrulama hatası',
          details: formattedErrors,
        });
        return;
      }

      // Unexpected error
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Beklenmeyen bir hata oluştu',
      });
    }
  };
};

/**
 * Validate request body
 */
export const validateBody = (schema: ZodSchema) => validate(schema, 'body');

/**
 * Validate query parameters
 */
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query');

/**
 * Validate route parameters
 */
export const validateParams = (schema: ZodSchema) => validate(schema, 'params');

/**
 * Combined validation for body and params
 */
export const validateAll = (
  bodySchema?: ZodSchema,
  paramsSchema?: ZodSchema,
  querySchema?: ZodSchema
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors: Array<{ field: string; message: string; source: string }> = [];

      if (bodySchema) {
        const bodyResult = bodySchema.safeParse(req.body);
        if (!bodyResult.success) {
          bodyResult.error.issues.forEach((err: ZodIssue) => {
            errors.push({
              field: err.path.join('.'),
              message: err.message,
              source: 'body',
            });
          });
        } else {
          req.body = bodyResult.data;
        }
      }

      if (paramsSchema) {
        const paramsResult = paramsSchema.safeParse(req.params);
        if (!paramsResult.success) {
          paramsResult.error.issues.forEach((err: ZodIssue) => {
            errors.push({
              field: err.path.join('.'),
              message: err.message,
              source: 'params',
            });
          });
        } else {
          req.params = paramsResult.data as Record<string, string>;
        }
      }

      if (querySchema) {
        const queryResult = querySchema.safeParse(req.query);
        if (!queryResult.success) {
          queryResult.error.issues.forEach((err: ZodIssue) => {
            errors.push({
              field: err.path.join('.'),
              message: err.message,
              source: 'query',
            });
          });
        } else {
          req.query = queryResult.data as Record<string, string>;
        }
      }

      if (errors.length > 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Doğrulama hatası',
          details: errors,
        });
        return;
      }

      next();
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Beklenmeyen bir hata oluştu',
      });
    }
  };
};
