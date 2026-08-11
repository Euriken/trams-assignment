export const NATS_STREAM_NAME = 'USERS';
export const NATS_STREAM_SUBJECTS = ['user.>'];
export const NATS_CONSUMER_DURABLE_NAME = 'notification-service';

export const NATS_STREAM_CONFIG = {
  name: NATS_STREAM_NAME,
  subjects: NATS_STREAM_SUBJECTS,
  retention: 'limits' as const,
  max_msgs: 100000,
  max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days in nanoseconds
  max_bytes: 100 * 1024 * 1024, // 100MB
  storage: 'file' as const,
  num_replicas: 1,
  duplicate_window: 120_000_000_000, // 2 minutes in nanoseconds
};

export const NATS_CONSUMER_CONFIG = {
  durable_name: NATS_CONSUMER_DURABLE_NAME,
  ack_policy: 'explicit' as const,
  ack_wait: 30_000_000_000, // 30 seconds in nanoseconds
  max_deliver: 5,
  deliver_policy: 'all' as const,
  filter_subjects: ['user.created', 'user.updated'],
};
