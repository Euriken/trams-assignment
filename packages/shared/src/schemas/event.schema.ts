import { z } from 'zod';

export const baseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  timestamp: z.string().datetime(),
  correlationId: z.string(),
  data: z.unknown(),
});

export const userCreatedEventDataSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string(),
});

export const userUpdatedEventDataSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  updatedAt: z.string(),
  changes: z.array(z.string()),
});

export const notificationUserIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});
