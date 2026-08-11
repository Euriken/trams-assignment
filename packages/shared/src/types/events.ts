export interface BaseEvent<T = unknown> {
  eventId: string;
  eventType: string;
  timestamp: string;
  correlationId: string;
  data: T;
}

export interface UserCreatedEventData {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UserUpdatedEventData {
  userId: string;
  email: string;
  name: string;
  updatedAt: string;
  changes: string[];
}

export type UserCreatedEvent = BaseEvent<UserCreatedEventData>;
export type UserUpdatedEvent = BaseEvent<UserUpdatedEventData>;
export type UserEvent = UserCreatedEvent | UserUpdatedEvent;
