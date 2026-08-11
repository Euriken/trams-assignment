export const EventTypes = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];
