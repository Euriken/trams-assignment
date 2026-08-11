import {
  connect,
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
  StringCodec,
  ConsumerMessages,
  JsMsg,
} from 'nats';
import { config } from '../config.js';
import { NotificationService } from './notification.service.js';
import {
  createLogger,
  EventTypes,
  NATS_STREAM_NAME,
  NATS_STREAM_SUBJECTS,
  NATS_CONSUMER_DURABLE_NAME,
} from '@microservices/shared';
import type { BaseEvent, UserCreatedEventData, UserUpdatedEventData } from '@microservices/shared';

const logger = createLogger('notification-service:nats-consumer');
const sc = StringCodec();

let nc: NatsConnection | null = null;
let consumerMessages: ConsumerMessages | null = null;

const notificationService = new NotificationService();

export async function connectAndConsume(): Promise<void> {
  try {
    const opts: Record<string, unknown> = {
      servers: config.nats.url,
      name: 'notification-service-consumer',
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

    const jsm: JetStreamManager = await nc.jetstreamManager();

    // Ensure stream exists (in case notification service starts before user service)
    try {
      await jsm.streams.info(NATS_STREAM_NAME);
      logger.info({ stream: NATS_STREAM_NAME }, 'Stream exists');
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
      logger.info({ stream: NATS_STREAM_NAME }, 'Stream created by notification service');
    }

    // Create or update durable consumer
    try {
      await jsm.consumers.info(NATS_STREAM_NAME, NATS_CONSUMER_DURABLE_NAME);
      logger.info({ consumer: NATS_CONSUMER_DURABLE_NAME }, 'Consumer already exists');
    } catch {
      await jsm.consumers.add(NATS_STREAM_NAME, {
        durable_name: NATS_CONSUMER_DURABLE_NAME,
        ack_policy: 'explicit' as never,
        ack_wait: 30_000_000_000,
        max_deliver: 5,
        deliver_policy: 'all' as never,
        filter_subjects: ['user.created', 'user.updated'],
      });
      logger.info({ consumer: NATS_CONSUMER_DURABLE_NAME }, 'Consumer created');
    }

    const js: JetStreamClient = nc.jetstream();
    const consumer = await js.consumers.get(NATS_STREAM_NAME, NATS_CONSUMER_DURABLE_NAME);

    consumerMessages = await consumer.consume();

    logger.info('Started consuming messages');

    // Process messages
    (async () => {
      if (!consumerMessages) return;
      for await (const msg of consumerMessages) {
        await processMessage(msg);
      }
    })().catch((err) => {
      if (nc && !nc.isClosed()) {
        logger.error({ err }, 'Consumer loop error');
      }
    });

    // Monitor connection status
    (async () => {
      if (!nc) return;
      for await (const s of nc.status()) {
        logger.info({ type: s.type, data: String(s.data) }, 'NATS connection status change');
      }
    })().catch(() => { /* connection closed */ });
  } catch (err) {
    logger.error({ err }, 'Failed to connect to NATS or start consumer');
    throw err;
  }
}

async function processMessage(msg: JsMsg): Promise<void> {
  const subject = msg.subject;
  const deliveryCount = msg.info.redeliveryCount + 1;

  let eventData: string;
  try {
    eventData = sc.decode(msg.data);
  } catch (err) {
    logger.error({ err, subject }, 'Failed to decode message data');
    msg.term();
    return;
  }

  let event: BaseEvent<unknown>;
  try {
    event = JSON.parse(eventData) as BaseEvent<unknown>;
  } catch (err) {
    logger.error({ err, subject, rawData: eventData.substring(0, 200) }, 'Failed to parse message JSON');
    msg.term();
    return;
  }

  logger.info(
    {
      subject,
      eventId: event.eventId,
      eventType: event.eventType,
      deliveryCount,
      correlationId: event.correlationId,
    },
    'Received message'
  );

  try {
    switch (subject) {
      case EventTypes.USER_CREATED:
        await notificationService.processUserCreatedEvent(event as BaseEvent<UserCreatedEventData>);
        break;
      case EventTypes.USER_UPDATED:
        await notificationService.processUserUpdatedEvent(event as BaseEvent<UserUpdatedEventData>);
        break;
      default:
        logger.warn({ subject }, 'Unknown event subject');
        msg.term();
        return;
    }

    // Acknowledge after successful processing
    msg.ack();
    logger.info({ eventId: event.eventId, subject }, 'Message acknowledged');
  } catch (err) {
    logger.error(
      { err, eventId: event.eventId, subject, deliveryCount, maxDeliver: 5 },
      'Failed to process message'
    );

    if (deliveryCount >= 5) {
      // Max deliveries reached — terminate (dead letter behavior)
      logger.error(
        { eventId: event.eventId, subject, deliveryCount },
        'Max delivery attempts reached. Terminating message (dead letter).'
      );
      msg.term();
    } else {
      // NAK to trigger redelivery
      msg.nak();
      logger.info(
        { eventId: event.eventId, subject, deliveryCount },
        'Message NAKed for redelivery'
      );
    }
  }
}

export async function closeNats(): Promise<void> {
  if (consumerMessages) {
    consumerMessages.stop();
    consumerMessages = null;
  }
  if (nc) {
    await nc.drain();
    logger.info('NATS connection drained and closed');
    nc = null;
  }
}

export function isNatsConnected(): boolean {
  return nc !== null && !nc.isClosed();
}
