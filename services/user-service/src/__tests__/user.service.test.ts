import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../db/connection.js', () => ({
  pool: {
    query: vi.fn(),
  },
  initializeDatabase: vi.fn(),
  closeDatabase: vi.fn(),
}));

vi.mock('../services/nats.publisher.js', () => ({
  connectNats: vi.fn(),
  closeNats: vi.fn(),
  publishEvent: vi.fn().mockResolvedValue(undefined),
  isNatsConnected: vi.fn().mockReturnValue(true),
}));

import { pool } from '../db/connection.js';
import { publishEvent } from '../services/nats.publisher.js';

const mockPool = vi.mocked(pool);
const mockPublishEvent = vi.mocked(publishEvent);

describe('User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /users', () => {
    it('should create a user and publish event', async () => {
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'john@example.com',
        name: 'John Doe',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };

      // Mock existsByEmail (no existing user)
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });
      // Mock insert
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1, command: 'INSERT', oid: 0, fields: [] });

      const { UserService } = await import('../services/user.service.js');
      const service = new UserService();

      const result = await service.createUser({ email: 'john@example.com', name: 'John Doe' });

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe('john@example.com');
      expect(result.name).toBe('John Doe');
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'user.created',
        expect.objectContaining({
          eventType: 'user.created',
          data: expect.objectContaining({
            userId: mockUser.id,
            email: 'john@example.com',
            name: 'John Doe',
          }),
        })
      );
    });

    it('should reject duplicate email', async () => {
      // Mock existsByEmail returns true
      mockPool.query.mockResolvedValueOnce({ rows: [{ '1': 1 }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] });

      const { UserService } = await import('../services/user.service.js');
      const service = new UserService();

      await expect(service.createUser({ email: 'duplicate@example.com', name: 'Test' }))
        .rejects.toThrow('A user with this email already exists');
    });
  });

  describe('GET /users/:id', () => {
    it('should return a user by ID', async () => {
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'jane@example.com',
        name: 'Jane Doe',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1, command: 'SELECT', oid: 0, fields: [] });

      const { UserService } = await import('../services/user.service.js');
      const service = new UserService();

      const result = await service.getUserById('550e8400-e29b-41d4-a716-446655440000');
      expect(result.email).toBe('jane@example.com');
    });

    it('should throw 404 for non-existent user', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });

      const { UserService } = await import('../services/user.service.js');
      const service = new UserService();

      await expect(service.getUserById('550e8400-e29b-41d4-a716-446655440000'))
        .rejects.toThrow('User not found');
    });
  });

  describe('PUT /users/:id', () => {
    it('should update a user and publish event', async () => {
      const existingUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'old@example.com',
        name: 'Old Name',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };
      const updatedUser = {
        ...existingUser,
        name: 'New Name',
        updated_at: new Date('2024-01-02T00:00:00Z'),
      };

      // findById
      mockPool.query.mockResolvedValueOnce({ rows: [existingUser], rowCount: 1, command: 'SELECT', oid: 0, fields: [] });
      // update
      mockPool.query.mockResolvedValueOnce({ rows: [updatedUser], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] });

      const { UserService } = await import('../services/user.service.js');
      const service = new UserService();

      const result = await service.updateUser('550e8400-e29b-41d4-a716-446655440000', { name: 'New Name' });
      expect(result.name).toBe('New Name');
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'user.updated',
        expect.objectContaining({
          eventType: 'user.updated',
          data: expect.objectContaining({
            changes: ['name'],
          }),
        })
      );
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete an existing user', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'DELETE', oid: 0, fields: [] });

      const { UserService } = await import('../services/user.service.js');
      const service = new UserService();

      await expect(service.deleteUser('550e8400-e29b-41d4-a716-446655440000')).resolves.toBeUndefined();
    });

    it('should throw 404 for non-existent user', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'DELETE', oid: 0, fields: [] });

      const { UserService } = await import('../services/user.service.js');
      const service = new UserService();

      await expect(service.deleteUser('550e8400-e29b-41d4-a716-446655440000'))
        .rejects.toThrow('User not found');
    });
  });

  describe('Validation', () => {
    it('should validate createUser schema', async () => {
      const { createUserSchema } = await import('@microservices/shared');

      const validResult = createUserSchema.safeParse({ email: 'test@test.com', name: 'Test' });
      expect(validResult.success).toBe(true);

      const invalidEmail = createUserSchema.safeParse({ email: 'notanemail', name: 'Test' });
      expect(invalidEmail.success).toBe(false);

      const missingName = createUserSchema.safeParse({ email: 'test@test.com' });
      expect(missingName.success).toBe(false);

      const emptyName = createUserSchema.safeParse({ email: 'test@test.com', name: '' });
      expect(emptyName.success).toBe(false);
    });

    it('should validate updateUser schema', async () => {
      const { updateUserSchema } = await import('@microservices/shared');

      const validResult = updateUserSchema.safeParse({ name: 'New Name' });
      expect(validResult.success).toBe(true);

      const emptyBody = updateUserSchema.safeParse({});
      expect(emptyBody.success).toBe(false);
    });

    it('should validate user ID param', async () => {
      const { userIdParamSchema } = await import('@microservices/shared');

      const valid = userIdParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' });
      expect(valid.success).toBe(true);

      const invalid = userIdParamSchema.safeParse({ id: 'not-a-uuid' });
      expect(invalid.success).toBe(false);
    });
  });
});
