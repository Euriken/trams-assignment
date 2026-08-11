import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@microservices/shared';

const logger = createLogger('api-gateway:error');

export function errorHandler(
  err: Error & { statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;

  if (statusCode === 500) {
    logger.error({ err }, 'Unhandled gateway error');
  }

  // Never expose internal error details in production
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    error: message,
  });
}
