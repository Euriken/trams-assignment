import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { createLogger } from '@microservices/shared';

const logger = createLogger('api-gateway:auth');

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/health',
  '/auth/token',
];

export interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for public paths
  if (PUBLIC_PATHS.some(path => req.path === path || req.path.startsWith(path))) {
    next();
    return;
  }

  // Also skip auth for health endpoints on downstream services
  if (req.path.endsWith('/health')) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logger.info('Token expired');
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      logger.info('Invalid token');
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    logger.error({ err }, 'Token verification error');
    res.status(401).json({ error: 'Authentication failed' });
  }
}
