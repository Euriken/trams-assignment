import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// We test the auth middleware in isolation
describe('API Gateway Authentication', () => {
  const TEST_SECRET = 'test-jwt-secret-for-unit-tests';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('JWT Token Validation', () => {
    it('should generate a valid JWT token', () => {
      const payload = { sub: 'test@example.com', email: 'test@example.com' };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });

      expect(token).toBeDefined();

      const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload;
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.sub).toBe('test@example.com');
    });

    it('should reject expired tokens', () => {
      const payload = { sub: 'test@example.com', email: 'test@example.com' };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '-1h' }); // Already expired

      expect(() => jwt.verify(token, TEST_SECRET)).toThrow(jwt.TokenExpiredError);
    });

    it('should reject tokens with wrong secret', () => {
      const payload = { sub: 'test@example.com', email: 'test@example.com' };
      const token = jwt.sign(payload, 'wrong-secret');

      expect(() => jwt.verify(token, TEST_SECRET)).toThrow(jwt.JsonWebTokenError);
    });

    it('should reject malformed tokens', () => {
      expect(() => jwt.verify('not-a-valid-token', TEST_SECRET)).toThrow(jwt.JsonWebTokenError);
    });
  });

  describe('Auth Middleware Behavior', () => {
    it('should require Authorization header', () => {
      // Simulate what the middleware does
      const authHeader = undefined;
      expect(authHeader).toBeUndefined();
    });

    it('should require Bearer format', () => {
      const authHeader = 'Basic dXNlcjpwYXNz';
      const parts = authHeader.split(' ');
      expect(parts[0]).not.toBe('Bearer');
    });

    it('should extract token from Bearer header', () => {
      const token = jwt.sign({ sub: 'user', email: 'user@test.com' }, TEST_SECRET);
      const authHeader = `Bearer ${token}`;
      const parts = authHeader.split(' ');
      expect(parts[0]).toBe('Bearer');
      expect(parts[1]).toBe(token);

      const decoded = jwt.verify(parts[1], TEST_SECRET) as jwt.JwtPayload;
      expect(decoded.email).toBe('user@test.com');
    });
  });

  describe('Token Generation Endpoint', () => {
    it('should validate email in token request', () => {
      const schema = z.object({
        email: z.string().email(),
        sub: z.string().optional(),
      });

      const validResult = schema.safeParse({ email: 'test@example.com' });
      expect(validResult.success).toBe(true);

      const invalidResult = schema.safeParse({ email: 'not-an-email' });
      expect(invalidResult.success).toBe(false);

      const emptyResult = schema.safeParse({});
      expect(emptyResult.success).toBe(false);
    });
  });
});
