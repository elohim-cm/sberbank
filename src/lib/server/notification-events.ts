import "server-only";
import { ObjectId, type ClientSession } from "mongodb";
import { getDatabase, getMongoClient } from "./mongodb";
import { notificationCollection, queueEmail } from "./notifications";
import { validKycRejectionReason } from "../kyc";

// Contracts for the future back office / payment integration. Neither function
// approves a KYC nor moves money: it verifies an already confirmed business event.
type ApprovedKyc = { _id: ObjectId; accountId: ObjectId; status: string; approvedAt?: Date; emailNotificationQueued?: boolean };
type ConfirmedTransfer = {
  _id: ObjectId; accountId: ObjectId; status: string; amountMinor: number;
  currency: "RUB"; reference: string; confirmedAt: Date; emailNotificationQueued?: boolean;
};

export async function queueKycApprovedEmail(requestId: ObjectId, session: ClientSession) {
  const db = await getDatabase();
  const requests = db.collection<ApprovedKyc>("kyc_requests");
  const request = await requests.findOne({ _id: requestId, status: "approved" }, { session });
  if (!request || !(request.approvedAt instanceof Date)) throw new Error("KYC approval is not confirmed");
  const account = await db.collection("accounts").findOne({ _id: request.accountId, kycStatus: "approved" }, { session, projection: { _id: 1 } });
  if (!account) throw new Error("Account KYC approval is not confirmed");
  await queueEmail(request.accountId, `kyc_approved:${request._id}`, { kind: "kyc_approved" }, session);
  await requests.updateOne({ _id: request._id }, { $set: { emailNotificationQueued: true } }, { session });
}

export async function queueIncomingTransferEmail(transferId: ObjectId, session: ClientSession) {
  const db = await getDatabase();
  const transfers = db.collection<ConfirmedTransfer>("incoming_transfers");
  const transfer = await transfers.findOne({ _id: transferId, status: "confirmed" }, { session });
  if (!transfer || !(transfer.confirmedAt instanceof Date) || transfer.currency !== "RUB" || !Number.isSafeInteger(transfer.amountMinor) || transfer.amountMinor <= 0 || typeof transfer.reference !== "string" || !transfer.reference.trim() || transfer.reference.length > 150) throw new Error("Incoming transfer is not confirmed");
  const account = await db.collection("accounts").findOne({ _id: transfer.accountId }, { session, projection: { _id: 1 } });
  if (!account) throw new Error("Transfer account does not exist");
  await queueEmail(transfer.accountId, `incoming_transfer:${transfer._id}`, {
    kind: "incoming_transfer", amountMinor: transfer.amountMinor, currency: transfer.currency, reference: transfer.reference,
  }, session);
  await transfers.updateOne({ _id: transfer._id }, { $set: { emailNotificationQueued: true } }, { session });
}

export async function queueKycRejectedEmail(requestId: ObjectId, session: ClientSession) {
  const db = await getDatabase();
  const requests = db.collection<{ _id: ObjectId; accountId: ObjectId; status: string; rejectedAt?: Date; rejectionReason?: string; emailNotificationQueued?: boolean }>("kyc_requests");
  const request = await requests.findOne({ _id: requestId, status: "rejected" }, { session });
  if (!request || !(request.rejectedAt instanceof Date) || !validKycRejectionReason(request.rejectionReason)) throw new Error("KYC rejection is not confirmed");
  const account = await db.collection("accounts").findOne({ _id: request.accountId, kycStatus: "rejected" }, { session, projection: { _id: 1 } });
  if (!account) throw new Error("Account KYC rejection is not confirmed");
  await queueEmail(request.accountId, `kyc_rejected:${request._id}`, { kind: "kyc_rejected", reason: request.rejectionReason.trim() }, session);
  await requests.updateOne({ _id: request._id }, { $set: { emailNotificationQueued: true } }, { session });
}

// Recovery when confirmed events were written outside the application. A raw
// balance edit is deliberately not interpreted as a confirmed incoming transfer.
export async function queueConfirmedEventNotifications() {
  await notificationCollection();
  const db = await getDatabase();
  const client = await getMongoClient();
  let queued = 0;
  let skipped = 0;
  const deadline = Date.now() + 15_000;
  const sources = [
    { collection: "kyc_requests", status: "approved", queue: queueKycApprovedEmail },
    { collection: "kyc_requests", status: "rejected", queue: queueKycRejectedEmail },
    { collection: "incoming_transfers", status: "confirmed", queue: queueIncomingTransferEmail },
  ];
  for (const source of sources) {
    if (Date.now() >= deadline) break;
    const records = await db.collection(source.collection).find({ status: source.status, emailNotificationQueued: { $ne: true } }, { projection: { _id: 1 } }).sort({ _id: 1 }).limit(25).toArray();
    for (const record of records) {
      if (Date.now() >= deadline) break;
      try {
        await client.withSession(session => session.withTransaction(() => source.queue(record._id, session)));
        queued++;
      } catch { skipped++; }
    }
  }
  return { queued, skipped };
}
