import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'node:async_hooks';

const correlationStore = new AsyncLocalStorage<string>();

export function generateCorrelationId(): string {
  return uuidv4();
}

export function getCorrelationId(): string {
  return correlationStore.getStore() || 'no-correlation-id';
}

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationStore.run(correlationId, fn);
}

export { correlationStore };
