import express from 'express';
import { createLogger } from '@microservices/shared';
import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { proxyRoutes } from './routes/proxy.js';
import { authRoutes } from './routes/auth.js';

const logger = createLogger('api-gateway');
const app = express();

// Middleware order matters
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger);
app.use(rateLimiter);

// Auth routes (before auth middleware since token endpoint is public)
app.use('/auth', authRoutes);

// JWT authentication
app.use(authMiddleware);

// Proxy routes
app.use(proxyRoutes);

// Error handler
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'API Gateway started');
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully...');
  server.close(() => {
    logger.info('Shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app };
