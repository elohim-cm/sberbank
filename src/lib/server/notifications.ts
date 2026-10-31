import "server-only";
import { randomUUID } from "node:crypto";
import { ObjectId, type ClientSession } from "mongodb";
import { getDatabase } from "./mongodb";
import { brevoConfiguration, EmailDeliveryError, sendBrevoEmail, type EmailEvent } from "./brevo";

type Notification = {
  _id: string; accountId: ObjectId; event: EmailEvent; idempotencyKey: string;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number; createdAt: Date; nextAttemptAt: Date; leaseUntil: Date;
  leaseToken?: string; sentAt?: Date; messageId?: string | null; errorCode?: string;
};

const eventKinds = new Set(["account_created", "kyc_received", "kyc_approved", "kyc_rejected", "incoming_transfer"]);
function checkEventKey(eventKey: string, event: EmailEvent) {
  const kind = eventKey.split(":")[0];
  if (eventKinds.has(kind) && event.kind !== kind) throw new EmailDeliveryError("notification_event_mismatch", false);
}

let indexes: Promise<unknown> | undefined;
export async function notificationCollection() {
  const collection = (await getDatabase()).collection<Notification>("email_notifications");
  if (!indexes) indexes = collection.createIndex({ status: 1, nextAttemptAt: 1, leaseUntil: 1 }, { name: "email_delivery_queue" }).catch(error => { indexes = undefined; throw error; });
  await indexes;
  return collection;
}

// Called inside the same transaction as the business event. MongoDB's unique
// _id prevents retries of a request from creating a second notification.
export async function queueEmail(accountId: ObjectId, eventKey: string, event: EmailEvent, session: ClientSession) {
  checkEventKey(eventKey, event);
  const collection = await notificationCollection();
  const now = new Date();
  await collection.updateOne({ _id: eventKey }, { $setOnInsert: {
    accountId, event, idempotencyKey: randomUUID(), status: "queued", attempts: 0,
    createdAt: now, nextAttemptAt: now, leaseUntil: new Date(0),
  } }, { upsert: true, session });
}

export async function deliverEmails(accountId?: ObjectId, limit = 3, eventKey?: string) {
  if (!brevoConfiguration()) return { configured: false, sent: 0, failed: 0 };
  const collection = await notificationCollection();
  const accounts = (await getDatabase()).collection<{ _id: ObjectId; email: string; firstName: string }>("accounts");
  const result = { configured: true, sent: 0, failed: 0 };
  const deadline = Date.now() + 35_000;
  for (let index = 0; index < limit && Date.now() < deadline; index++) {
    const now = new Date();
    const leaseToken = randomUUID();
    const notification = await collection.findOneAndUpdate({
      ...(accountId ? { accountId } : {}), status: { $in: ["queued", "sending"] },
      ...(eventKey ? { _id: eventKey } : {}),
      nextAttemptAt: { $lte: now }, leaseUntil: { $lte: now },
    }, { $set: { status: "sending", leaseToken, leaseUntil: new Date(now.getTime() + 120_000) }, $inc: { attempts: 1 } }, { sort: { createdAt: 1 }, returnDocument: "after" });
    if (!notification) break;
    const claim = { _id: notification._id, status: "sending" as const, leaseToken };
    try {
      checkEventKey(notification._id, notification.event);
      const account = await accounts.findOne({ _id: notification.accountId });
      if (!account) throw new EmailDeliveryError("account_missing", false);
      const delivered = await sendBrevoEmail(account, notification.event, notification.idempotencyKey);
      await collection.updateOne(claim, { $set: { status: "sent", sentAt: new Date(), messageId: delivered.messageId }, $unset: { leaseToken: "", errorCode: "" } });
      result.sent++;
    } catch (error) {
      const known = error instanceof EmailDeliveryError ? error : new EmailDeliveryError("delivery_error", true);
      const retry = known.retryable && notification.attempts < 8;
      const delay = Math.min(24 * 60 * 60_000, 60_000 * 2 ** notification.attempts);
      await collection.updateOne(claim, { $set: { status: retry ? "queued" : "failed", errorCode: known.code, nextAttemptAt: new Date(Date.now() + delay), leaseUntil: new Date(0) }, $unset: { leaseToken: "" } });
      result.failed++;
    }
  }
  return result;
}

// A provider outage must never invalidate an account or a submitted KYC dossier.
export async function deliverEmailsSafely(accountId?: ObjectId, eventKey?: string) {
  try { return await deliverEmails(accountId, 3, eventKey); }
  catch { console.error("Email queue processing failed"); return null; }
}
