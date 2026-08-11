import { pool } from '../db/connection.js';
import { createLogger } from '@microservices/shared';
import type { Notification, NotificationStatus, NotificationChannel } from '@microservices/shared';

const logger = createLogger('notification-service:repository');

interface CreateNotificationDto {
  userId: string;
  eventId: string;
  eventType: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  content: string;
  error?: string;
}

export class NotificationRepository {
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, event_id, event_type, channel, status, content, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [dto.userId, dto.eventId, dto.eventType, dto.channel, dto.status, dto.content, dto.error || null]
    );
    return this.mapRow(rows[0]);
  }

  async findByUserId(userId: string): Promise<Notification[]> {
    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(this.mapRow);
  }

  async findByEventId(eventId: string): Promise<Notification | null> {
    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE event_id = $1',
      [eventId]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async updateStatus(id: string, status: NotificationStatus, error?: string): Promise<void> {
    await pool.query(
      `UPDATE notifications SET status = $1, error = $2, updated_at = NOW(),
       retry_count = CASE WHEN $1 = 'failed' THEN retry_count + 1 ELSE retry_count END
       WHERE id = $3`,
      [status, error || null, id]
    );
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    const { rows } = await pool.query(
      'SELECT 1 FROM processed_events WHERE event_id = $1',
      [eventId]
    );
    return rows.length > 0;
  }

  async markEventProcessed(eventId: string, eventType: string): Promise<void> {
    try {
      await pool.query(
        'INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING',
        [eventId, eventType]
      );
    } catch (err) {
      logger.error({ err, eventId }, 'Failed to mark event as processed');
      throw err;
    }
  }

  private mapRow(row: Record<string, unknown>): Notification {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      eventId: row.event_id as string,
      eventType: row.event_type as string,
      channel: row.channel as NotificationChannel,
      status: row.status as NotificationStatus,
      content: row.content as string,
      error: row.error as string | null,
      retryCount: row.retry_count as number,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}
