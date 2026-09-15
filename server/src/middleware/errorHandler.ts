import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // AppError — controlled application errors
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.code, err.details);
    return;
  }

  // MongoDB duplicate key error
  if ((err as any).code === 11000) {
    const keyPattern = (err as any).keyPattern || {};
    const field = Object.keys(keyPattern)[0] || 'field';
    sendError(
      res,
      `Duplicate value for ${field}. This ${field} already exists.`,
      409,
      'DUPLICATE_KEY',
      { field }
    );
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values((err as any).errors).map(
      (e: any) => e.message
    );
    sendError(res, 'Validation failed', 422, 'VALIDATION_ERROR', {
      errors: messages,
    });
    return;
  }

  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    sendError(res, err.message, 400, 'FILE_UPLOAD_ERROR');
    return;
  }

  // JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, 'Invalid JSON in request body', 400, 'INVALID_JSON');
    return;
  }

  // Unknown errors — safe message
  console.error('Unhandled error:', err);
  sendError(
    res,
    'Internal server error',
    500,
    'INTERNAL_ERROR'
  );
}
