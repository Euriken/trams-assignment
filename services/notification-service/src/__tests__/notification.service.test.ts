import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../db/connection.js', () => ({
  pool: {
    query: vi.fn(),
  },
  initializeDatabase: vi.fn(),
  closeDatabase: vi.fn(),
}));

import { pool } from '../db/connection.js';

const mockPool = vi.mocked(pool);

describe('Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Processing', () => {
    it('should process user.created event and create notification', async () => {
      const mockNotification = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        event_id: '770e8400-e29b-41d4-a716-446655440000',
        event_type: 'user.created',
        channel: 'email',
        status: 'sent',
        content: 'Welcome! Your account has been created successfully.',
        error: null,
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // isEventProcessed returns false (not yet processed)
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });
      // create notification
      mockPool.query.mockResolvedValueOnce({ rows: [mockNotification], rowCount: 1, command: 'INSERT', oid: 0, fields: [] });
      // markEventProcessed
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] });

      const { NotificationService } = await import('../services/notification.service.js');
      const service = new NotificationService();

      const event = {
        eventId: '770e8400-e29b-41d4-a716-446655440000',
        eventType: 'user.created',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation-id',
        data: {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'john@example.com',
          name: 'John Doe',
          createdAt: new Date().toISOString(),
        },
      };

      await expect(service.processUserCreatedEvent(event)).resolves.toBeUndefined();

      // Verify notification was created
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining(['550e8400-e29b-41d4-a716-446655440000'])
      );

      // Verify event was marked as processed
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO processed_events'),
        expect.arrayContaining(['770e8400-e29b-41d4-a716-446655440000'])
      );
    });

    it('should skip already-processed events (idempotency)', async () => {
      // isEventProcessed returns true
      mockPool.query.mockResolvedValueOnce({ rows: [{ '1': 1 }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] });

      const { NotificationService } = await import('../services/notification.service.js');
      const service = new NotificationService();

      const event = {
        eventId: '770e8400-e29b-41d4-a716-446655440000',
        eventType: 'user.created',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation-id',
        data: {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'john@example.com',
          name: 'John Doe',
          createdAt: new Date().toISOString(),
        },
      };

      await expect(service.processUserCreatedEvent(event)).resolves.toBeUndefined();

      // Should NOT have created a notification (only 1 query for idempotency check)
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should process user.updated event', async () => {
      const mockNotification = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        event_id: '880e8400-e29b-41d4-a716-446655440000',
        event_type: 'user.updated',
        channel: 'email',
        status: 'sent',
        content: 'Profile updated.',
        error: null,
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // isEventProcessed
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });
      // create notification
      mockPool.query.mockResolvedValueOnce({ rows: [mockNotification], rowCount: 1, command: 'INSERT', oid: 0, fields: [] });
      // markEventProcessed
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] });

      const { NotificationService } = await import('../services/notification.service.js');
      const service = new NotificationService();

      const event = {
        eventId: '880e8400-e29b-41d4-a716-446655440000',
        eventType: 'user.updated',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation-id',
        data: {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'john@example.com',
          name: 'John Updated',
          updatedAt: new Date().toISOString(),
          changes: ['name'],
        },
      };

      await expect(service.processUserUpdatedEvent(event)).resolves.toBeUndefined();
    });
  });

  describe('Query Notifications', () => {
    it('should return notifications for a user', async () => {
      const mockNotifications = [
        {
          id: '660e8400-e29b-41d4-a716-446655440000',
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          event_id: '770e8400-e29b-41d4-a716-446655440000',
          event_type: 'user.created',
          channel: 'email',
          status: 'sent',
          content: 'Welcome!',
          error: null,
          retry_count: 0,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockNotifications, rowCount: 1, command: 'SELECT', oid: 0, fields: [] });

      const { NotificationService } = await import('../services/notification.service.js');
      const service = new NotificationService();

      const result = await service.getNotificationsByUserId('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result[0].status).toBe('sent');
    });
  });
});
