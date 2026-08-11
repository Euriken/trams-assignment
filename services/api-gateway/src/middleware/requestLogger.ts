import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@microservices/shared';

const logger = createLogger('api-gateway:request');

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: Date.now() - start,
      correlationId: req.headers['x-correlation-id'],
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }, 'Request completed');
  });

  next();
}
