import { NotificationRepository } from '../repositories/notification.repository.js';
import { config } from '../config.js';
import {
  createLogger,
  EventTypes,
} from '@microservices/shared';
import type {
  BaseEvent,
  UserCreatedEventData,
  UserUpdatedEventData,
  NotificationResponse,
} from '@microservices/shared';

const logger = createLogger('notification-service:service');

let processedCount = 0;

export class NotificationService {
  private readonly repository: NotificationRepository;

  constructor() {
    this.repository = new NotificationRepository();
  }

  async processUserCreatedEvent(event: BaseEvent<UserCreatedEventData>): Promise<void> {
    const { eventId, data, correlationId } = event;

    logger.info({ eventId, userId: data.userId, correlationId }, 'Processing user.created event');

    // Idempotency check
    const alreadyProcessed = await this.repository.isEventProcessed(eventId);
    if (alreadyProcessed) {
      logger.info({ eventId }, 'Event already processed, skipping (idempotent)');
      return;
    }

    // Simulate notification sending
    const content = `Welcome! Your account has been created successfully. Email: ${data.email}, Name: ${data.name}`;

    // Simulate potential failure
    this.checkSimulatedFailure(eventId);

    // Create notification record
    const notification = await this.repository.create({
      userId: data.userId,
      eventId,
      eventType: EventTypes.USER_CREATED,
      channel: 'email',
      status: 'sent',
      content,
    });

    // Mark event as processed (for idempotency)
    await this.repository.markEventProcessed(eventId, EventTypes.USER_CREATED);

    logger.info(
      { notificationId: notification.id, userId: data.userId, eventId, correlationId },
      'Welcome notification sent (simulated)'
    );
  }

  async processUserUpdatedEvent(event: BaseEvent<UserUpdatedEventData>): Promise<void> {
    const { eventId, data, correlationId } = event;

    logger.info({ eventId, userId: data.userId, changes: data.changes, correlationId }, 'Processing user.updated event');

    // Idempotency check
    const alreadyProcessed = await this.repository.isEventProcessed(eventId);
    if (alreadyProcessed) {
      logger.info({ eventId }, 'Event already processed, skipping (idempotent)');
      return;
    }

    const content = `Your profile has been updated. Changed fields: ${data.changes.join(', ')}. Email: ${data.email}, Name: ${data.name}`;

    // Simulate potential failure
    this.checkSimulatedFailure(eventId);

    const notification = await this.repository.create({
      userId: data.userId,
      eventId,
      eventType: EventTypes.USER_UPDATED,
      channel: 'email',
      status: 'sent',
      content,
    });

    await this.repository.markEventProcessed(eventId, EventTypes.USER_UPDATED);

    logger.info(
      { notificationId: notification.id, userId: data.userId, eventId, correlationId },
      'Profile update notification sent (simulated)'
    );
  }

  async getNotificationsByUserId(userId: string): Promise<NotificationResponse[]> {
    const notifications = await this.repository.findByUserId(userId);
    return notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      eventId: n.eventId,
      eventType: n.eventType,
      channel: n.channel,
      status: n.status,
      content: n.content,
      error: n.error,
      retryCount: n.retryCount,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));
  }

  /**
   * Simulates a processing failure every N notifications.
   * Set SIMULATE_FAILURE_EVERY_N env var to enable (e.g., 3 = fail every 3rd).
   */
  private checkSimulatedFailure(eventId: string): void {
    if (config.simulateFailureEveryN > 0) {
      processedCount++;
      if (processedCount % config.simulateFailureEveryN === 0) {
        logger.warn({ eventId, processedCount }, 'Simulating notification processing failure');
        throw new Error(`Simulated failure for event ${eventId} (every ${config.simulateFailureEveryN}th notification)`);
      }
    }
  }
}
