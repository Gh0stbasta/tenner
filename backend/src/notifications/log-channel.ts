import type { Logger } from "../utils/logger.js";
import type { DeliveryResult, NotificationChannel, NotificationMessage, Recipient } from "./model.js";

/**
 * LogChannel (NOTIFICATION-001): writes the notification as a structured log line instead of sending it. Used for
 * dry runs and as the default channel until a real one is connected. Logs subject and type, not the body.
 */
export class LogChannel implements NotificationChannel {
  readonly type = "LOG" as const;

  constructor(private readonly logger: Logger) {}

  async send(message: NotificationMessage, recipient: Recipient): Promise<DeliveryResult> {
    this.logger.info("Notification (log channel)", { event: "NotificationLogged", type: message.type, userId: recipient.userId, subject: message.subject });
    return { status: "SENT" };
  }
}
