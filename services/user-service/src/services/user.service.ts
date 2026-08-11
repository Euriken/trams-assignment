import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../repositories/user.repository.js';
import { publishEvent } from './nats.publisher.js';
import {
  createLogger,
  getCorrelationId,
  EventTypes,
} from '@microservices/shared';
import type {
  User,
  CreateUserDto,
  UpdateUserDto,
  UserResponse,
  UserCreatedEvent,
  UserUpdatedEvent,
} from '@microservices/shared';

const logger = createLogger('user-service:service');

export class UserService {
  private readonly repository: UserRepository;

  constructor() {
    this.repository = new UserRepository();
  }

  private toResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
    };
  }

  async createUser(dto: CreateUserDto): Promise<UserResponse> {
    // Check for duplicate email
    const exists = await this.repository.existsByEmail(dto.email);
    if (exists) {
      const error = new Error('A user with this email already exists') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    const user = await this.repository.create(dto);
    const response = this.toResponse(user);

    // Publish user.created event
    try {
      const event: UserCreatedEvent = {
        eventId: uuidv4(),
        eventType: EventTypes.USER_CREATED,
        timestamp: new Date().toISOString(),
        correlationId: getCorrelationId(),
        data: {
          userId: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at.toISOString(),
        },
      };
      await publishEvent(EventTypes.USER_CREATED, event);
      logger.info({ userId: user.id, eventId: event.eventId }, 'user.created event published');
    } catch (err) {
      // Log but don't fail the request — the user was already created
      logger.error({ err, userId: user.id }, 'Failed to publish user.created event');
    }

    return response;
  }

  async getUserById(id: string): Promise<UserResponse> {
    const user = await this.repository.findById(id);
    if (!user) {
      const error = new Error('User not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return this.toResponse(user);
  }

  async getUsers(limit?: number, offset?: number): Promise<{ users: UserResponse[]; total: number }> {
    const result = await this.repository.findAll(limit, offset);
    return {
      users: result.users.map(this.toResponse),
      total: result.total,
    };
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    // Check user exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      const error = new Error('User not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Check email uniqueness if changing email
    if (dto.email && dto.email !== existing.email) {
      const exists = await this.repository.existsByEmail(dto.email, id);
      if (exists) {
        const error = new Error('A user with this email already exists') as Error & { statusCode: number };
        error.statusCode = 409;
        throw error;
      }
    }

    const user = await this.repository.update(id, dto);
    if (!user) {
      const error = new Error('User not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const response = this.toResponse(user);

    // Determine what changed
    const changes: string[] = [];
    if (dto.email && dto.email !== existing.email) changes.push('email');
    if (dto.name && dto.name !== existing.name) changes.push('name');

    // Publish user.updated event
    if (changes.length > 0) {
      try {
        const event: UserUpdatedEvent = {
          eventId: uuidv4(),
          eventType: EventTypes.USER_UPDATED,
          timestamp: new Date().toISOString(),
          correlationId: getCorrelationId(),
          data: {
            userId: user.id,
            email: user.email,
            name: user.name,
            updatedAt: user.updated_at.toISOString(),
            changes,
          },
        };
        await publishEvent(EventTypes.USER_UPDATED, event);
        logger.info({ userId: user.id, eventId: event.eventId, changes }, 'user.updated event published');
      } catch (err) {
        logger.error({ err, userId: user.id }, 'Failed to publish user.updated event');
      }
    }

    return response;
  }

  async deleteUser(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      const error = new Error('User not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
  }
}
