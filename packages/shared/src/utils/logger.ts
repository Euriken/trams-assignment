import pino from 'pino';

const redactPaths = [
  'password',
  'token',
  'authorization',
  'secret',
  'req.headers.authorization',
];

export function createLogger(service: string) {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL || 'info',
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino/file', options: { destination: 1 } }
        : undefined,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = pino.Logger;
