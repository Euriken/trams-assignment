import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { createLogger } from '@microservices/shared';
import { z } from 'zod';

const logger = createLogger('api-gateway:auth');
const router = Router();

const tokenRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  sub: z.string().optional(),
});

// POST /auth/token — Generate JWT (development convenience endpoint)
router.post('/token', (req: Request, res: Response) => {
  try {
    const { email, sub } = tokenRequestSchema.parse(req.body);

    const payload = {
      sub: sub || email,
      email,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: '24h',
    });

    logger.info({ email }, 'Token generated');

    res.json({
      token,
      expiresIn: '24h',
      tokenType: 'Bearer',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

export { router as authRoutes };
