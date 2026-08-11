import express, { Request, Response, NextFunction } from 'express';
import { createLogger } from '@microservices/shared';
import { config } from './config.js';
import { initializeDatabase, closeDatabase } from './db/connection.js';
import { connectNats, closeNats, isNatsConnected } from './services/nats.publisher.js';
import { userRoutes } from './routes/user.routes.js';

const logger = createLogger('user-service');
const app = express();

// Middleware
app.use(express.json());

// Correlation ID propagation
app.use((req: Request, _res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] as string || '';
  req.headers['x-correlation-id'] = correlationId;
  next();
});

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: Date.now() - start,
      correlationId: req.headers['x-correlation-id'],
    }, 'Request completed');
  });
  next();
});

// Health endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'user-service',
    nats: isNatsConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/users', userRoutes);

// Error handler
app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  if (statusCode === 500) {
    logger.error({ err }, 'Unhandled error');
  }

  res.status(statusCode).json({
    error: message,
    ...(statusCode !== 500 && { details: err.message }),
  });
});

// Startup
async function start() {
  try {
    await initializeDatabase();
    logger.info('Database initialized');

    await connectNats();
    logger.info('NATS connected');

    const server = app.listen(config.port, () => {
      logger.info({ port: config.port }, 'User Service started');
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down gracefully...');
      server.close(async () => {
        await closeNats();
        await closeDatabase();
        logger.info('Shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Failed to start User Service');
    process.exit(1);
  }
}

start();

export { app };
