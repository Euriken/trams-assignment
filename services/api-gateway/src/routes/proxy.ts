import { Router, Request, Response } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { config } from '../config.js';
import { createLogger } from '@microservices/shared';

const logger = createLogger('api-gateway:proxy');
const router = Router();

// Proxy to User Service
router.use(
  createProxyMiddleware({
    pathFilter: '/api/users',
    target: config.userServiceUrl,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '/users' },
    on: {
      proxyReq: (proxyReq, req, _res) => {
        // Forward correlation ID
        const correlationId = (req as Request).headers['x-correlation-id'];
        if (correlationId) {
          proxyReq.setHeader('X-Correlation-ID', correlationId as string);
        }
        fixRequestBody(proxyReq, req);
      },
      error: (err, _req, res) => {
        logger.error({ err, target: 'user-service' }, 'Proxy error');
        if ('writeHead' in res && typeof res.writeHead === 'function') {
          (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' });
          (res as import('http').ServerResponse).end(JSON.stringify({ error: 'User Service unavailable' }));
        }
      },
    },
  })
);

// Proxy to Notification Service
router.use(
  createProxyMiddleware({
    pathFilter: '/api/notifications',
    target: config.notificationServiceUrl,
    changeOrigin: true,
    pathRewrite: { '^/api/notifications': '/notifications' },
    on: {
      proxyReq: (proxyReq, req, _res) => {
        const correlationId = (req as Request).headers['x-correlation-id'];
        if (correlationId) {
          proxyReq.setHeader('X-Correlation-ID', correlationId as string);
        }
        fixRequestBody(proxyReq, req);
      },
      error: (err, _req, res) => {
        logger.error({ err, target: 'notification-service' }, 'Proxy error');
        if ('writeHead' in res && typeof res.writeHead === 'function') {
          (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' });
          (res as import('http').ServerResponse).end(JSON.stringify({ error: 'Notification Service unavailable' }));
        }
      },
    },
  })
);

// Gateway health endpoint
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

export { router as proxyRoutes };
