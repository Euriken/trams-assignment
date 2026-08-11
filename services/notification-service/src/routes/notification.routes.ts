import { Router, Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service.js';
import { z } from 'zod';

const router = Router();
const notificationService = new NotificationService();

const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

// GET /notifications/:userId
router.get('/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const notifications = await notificationService.getNotificationsByUserId(userId);
    res.json({ notifications, total: notifications.length });
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
    next(err);
  }
});

export { router as notificationRoutes };
