export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  postgres: {
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'notifications_db',
  },
  nats: {
    url: process.env.NATS_URL || 'nats://localhost:4222',
    user: process.env.NATS_USER || '',
    password: process.env.NATS_PASSWORD || '',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
  // Simulate failure for every Nth notification (0 = no simulated failures)
  simulateFailureEveryN: parseInt(process.env.SIMULATE_FAILURE_EVERY_N || '0', 10),
};
