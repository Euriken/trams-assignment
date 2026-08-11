import express, { Request, Response, NextFunction } from 'express';
import { createLogger } from '@microservices/shared';
import { config } from './config.js';
import { initializeDatabase, closeDatabase } from './db/connection.js';
import { connectAndConsume, closeNats, isNatsConnected } from './services/nats.consumer.js';
import { notificationRoutes } from './routes/notification.routes.js';

const logger = createLogger('notification-service');
const app = express();

// Middleware
app.use(express.json());

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
    service: 'notification-service',
    nats: isNatsConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/notifications', notificationRoutes);

// Error handler
app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  if (statusCode === 500) {
    logger.error({ err }, 'Unhandled error');
  }

  res.status(statusCode).json({
    error: message,
  });
});

// Startup
async function start() {
  try {
    await initializeDatabase();
    logger.info('Database initialized');

    await connectAndConsume();
    logger.info('NATS consumer started');

    const server = app.listen(config.port, () => {
      logger.info({ port: config.port }, 'Notification Service started');
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

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Failed to start Notification Service');
    process.exit(1);
  }
}

start();

export { app };
