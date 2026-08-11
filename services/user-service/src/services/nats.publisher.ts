import { connect, NatsConnection, JetStreamClient, JetStreamManager, StringCodec } from 'nats';
import { config } from '../config.js';
import { createLogger, NATS_STREAM_NAME, NATS_STREAM_SUBJECTS } from '@microservices/shared';
import type { BaseEvent } from '@microservices/shared';

const logger = createLogger('user-service:nats-publisher');
const sc = StringCodec();

let nc: NatsConnection | null = null;
let js: JetStreamClient | null = null;

export async function connectNats(): Promise<void> {
  try {
    const opts: Record<string, unknown> = {
      servers: config.nats.url,
      name: 'user-service-publisher',
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000,
      pingInterval: 30000,
    };

    if (config.nats.user && config.nats.password) {
      opts.user = config.nats.user;
      opts.pass = config.nats.password;
    }

    nc = await connect(opts);
    logger.info({ server: config.nats.url }, 'Connected to NATS');

    // Setup JetStream
    const jsm: JetStreamManager = await nc.jetstreamManager();

    // Ensure stream exists
    try {
      await jsm.streams.info(NATS_STREAM_NAME);
      logger.info({ stream: NATS_STREAM_NAME }, 'Stream already exists');
    } catch {
      await jsm.streams.add({
        name: NATS_STREAM_NAME,
        subjects: NATS_STREAM_SUBJECTS,
        retention: 'limits' as never,
        max_msgs: 100000,
        max_age: 7 * 24 * 60 * 60 * 1_000_000_000,
        max_bytes: 100 * 1024 * 1024,
        storage: 'file' as never,
        num_replicas: 1,
        duplicate_window: 120_000_000_000,
      });
      logger.info({ stream: NATS_STREAM_NAME }, 'Stream created');
    }

    js = nc.jetstream();

    // Handle connection events
    (async () => {
      if (!nc) return;
      for await (const s of nc.status()) {
        logger.info({ type: s.type, data: String(s.data) }, 'NATS connection status change');
      }
    })().catch(() => { /* connection closed */ });
  } catch (err) {
    logger.error({ err }, 'Failed to connect to NATS');
    throw err;
  }
}

export async function publishEvent<T>(subject: string, event: BaseEvent<T>): Promise<void> {
  if (!js) {
    throw new Error('NATS JetStream not connected');
  }

  const data = sc.encode(JSON.stringify(event));

  try {
    const ack = await js.publish(subject, data, {
      msgID: event.eventId, // For deduplication
    });
    logger.info(
      {
        subject,
        eventId: event.eventId,
        eventType: event.eventType,
        seq: ack.seq,
        stream: ack.stream,
        correlationId: event.correlationId,
      },
      'Event published to NATS JetStream'
    );
  } catch (err) {
    logger.error({ err, subject, eventId: event.eventId }, 'Failed to publish event');
    throw err;
  }
}

export async function closeNats(): Promise<void> {
  if (nc) {
    await nc.drain();
    logger.info('NATS connection drained and closed');
    nc = null;
    js = null;
  }
}

export function isNatsConnected(): boolean {
  return nc !== null && !nc.isClosed();
}
