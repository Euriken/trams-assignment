export type NotificationStatus = 'pending' | 'sent' | 'failed';
export type NotificationChannel = 'email' | 'sms' | 'push';

export interface Notification {
  id: string;
  userId: string;
  eventId: string;
  eventType: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  content: string;
  error: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  eventId: string;
  eventType: string;
  channel: string;
  status: string;
  content: string;
  error: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}
