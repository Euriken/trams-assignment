import pg from 'pg';
import { config } from '../config.js';
import { createLogger } from '@microservices/shared';

const logger = createLogger('notification-service:db');

const pool = new pg.Pool({
  user: config.postgres.user,
  password: config.postgres.password,
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // Processed events table for idempotency
    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id UUID PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        event_id UUID NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        channel VARCHAR(50) NOT NULL DEFAULT 'email',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        content TEXT NOT NULL,
        error TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications(event_id);
    `);

    logger.info('Database initialized successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize database');
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

export { pool };
