export interface NotificationFactory {
  sendSMS(to: string, message: string): Promise<void>;
}
